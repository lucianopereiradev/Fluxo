/**
 * End-to-end encryption for sync, using only WebCrypto.
 *
 *   passphrase ──PBKDF2-SHA-256 (600k)──▶ 256-bit master ──HKDF──┬─▶ encKey  (AES-GCM-256)
 *                                                                └─▶ authKey (HMAC-SHA-256)
 *   authToken = HMAC(authKey, vaultId)      → server stores only SHA-256(authToken)
 *   payload   = AES-GCM(encKey, gzip(json)) → random 12-byte IV per upload, vaultId as AAD
 *
 * The passphrase and both keys never leave the device; keys are non-extractable.
 */

export const PBKDF2_ITERATIONS = 600_000;
const FORMAT_VERSION = 1;
const encoder = new TextEncoder();

export interface VaultKeys {
  encKey: CryptoKey;
  authKey: CryptoKey;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** 128 random bits, base64url (22 characters). */
export const newVaultId = () => toBase64Url(randomBytes(16));
export const newSalt = () => toBase64Url(randomBytes(16));

export async function deriveKeys(
  passphrase: string,
  salt: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<VaultKeys> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const master = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64Url(salt) as BufferSource, iterations, hash: 'SHA-256' },
    material,
    256,
  );
  const hkdf = await crypto.subtle.importKey('raw', master, 'HKDF', false, ['deriveKey']);
  const info = (label: string) => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: new Uint8Array(32),
    info: encoder.encode(label),
  });
  const [encKey, authKey] = await Promise.all([
    crypto.subtle.deriveKey(info('fluxo/v1/enc'), hkdf, { name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]),
    crypto.subtle.deriveKey(
      info('fluxo/v1/auth'),
      hkdf,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign'],
    ),
  ]);
  return { encKey, authKey };
}

/** The bearer token that proves knowledge of the passphrase for this vault. */
export async function authToken(authKey: CryptoKey, vaultId: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', authKey, encoder.encode(vaultId));
  return toBase64Url(new Uint8Array(mac));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function transform(
  data: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Layout: [version:1][iv:12][AES-GCM ciphertext of gzip(JSON)]. */
export async function encryptPayload(
  encKey: CryptoKey,
  vaultId: string,
  value: unknown,
): Promise<Uint8Array> {
  const compressed = await transform(
    encoder.encode(JSON.stringify(value)),
    new CompressionStream('gzip'),
  );
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(vaultId) },
    encKey,
    compressed as BufferSource,
  );
  const out = new Uint8Array(1 + iv.length + ciphertext.byteLength);
  out[0] = FORMAT_VERSION;
  out.set(iv, 1);
  out.set(new Uint8Array(ciphertext), 1 + iv.length);
  return out;
}

export class DecryptionError extends Error {
  constructor() {
    super('decryption_failed');
    this.name = 'DecryptionError';
  }
}

/** Throws DecryptionError for a wrong key, a different vault or tampered data. */
export async function decryptPayload(
  encKey: CryptoKey,
  vaultId: string,
  bytes: Uint8Array,
): Promise<unknown> {
  if (bytes.length < 1 + 12 + 16 || bytes[0] !== FORMAT_VERSION) throw new DecryptionError();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(1, 13), additionalData: encoder.encode(vaultId) },
      encKey,
      bytes.slice(13),
    );
    const json = await transform(new Uint8Array(plain), new DecompressionStream('gzip'));
    return JSON.parse(new TextDecoder().decode(json));
  } catch {
    throw new DecryptionError();
  }
}

export interface Strength {
  /** 0 (very weak) … 4 (very strong). */
  score: 0 | 1 | 2 | 3 | 4;
  bits: number;
  acceptable: boolean;
}

export const MIN_PASSPHRASE_BITS = 60;

/**
 * Rough entropy estimate. Multi-word passphrases are credited per word (assuming words from
 * a large vocabulary); otherwise by length and character variety, with penalties for
 * repetition and sequences.
 */
export function passphraseStrength(passphrase: string): Strength {
  const p = passphrase.trim();
  const words = p.split(/[\s\-_.]+/).filter((w) => w.length >= 3);
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26;
  if (/[A-Z]/.test(p)) pool += 26;
  if (/\d/.test(p)) pool += 10;
  if (/[^a-zA-Z\d\s]/.test(p)) pool += 33;
  if (/\s/.test(p)) pool += 1;
  const unique = new Set(p.toLowerCase()).size;
  let charBits =
    p.length * Math.log2(Math.max(pool, 1)) * Math.min(1, unique / Math.max(6, p.length * 0.6));
  if (/(.)\1{2,}/.test(p)) charBits *= 0.7;
  if (/(0123|1234|2345|abcd|qwer|asdf|senha|password)/i.test(p)) charBits *= 0.6;
  const wordBits =
    words.length >= 3 ? words.length * 12 + Math.max(0, p.length - words.length * 4) : 0;
  const bits = Math.round(Math.max(charBits, wordBits));
  const score = bits < 28 ? 0 : bits < 45 ? 1 : bits < MIN_PASSPHRASE_BITS ? 2 : bits < 80 ? 3 : 4;
  return { score, bits, acceptable: bits >= MIN_PASSPHRASE_BITS && p.length >= 12 };
}
