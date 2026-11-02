import { describe, expect, it } from 'vitest';
import {
  authToken,
  decryptPayload,
  DecryptionError,
  deriveKeys,
  encryptPayload,
  fromBase64Url,
  newSalt,
  newVaultId,
  passphraseStrength,
  PBKDF2_ITERATIONS,
  sha256Hex,
  toBase64Url,
} from './crypto';

const FAST = 1000; // fewer PBKDF2 iterations to keep most tests quick

describe('sync crypto', () => {
  it('uses 600k PBKDF2 iterations by default', () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000);
  });

  it('generates 128-bit vault ids and salts in base64url', () => {
    const id = newVaultId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(fromBase64Url(id)).toHaveLength(16);
    expect(newSalt()).not.toBe(newSalt());
  });

  it('round-trips base64url', () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 128, 1]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it('encrypts and decrypts a payload (default iterations)', async () => {
    const salt = newSalt();
    const vault = newVaultId();
    const keys = await deriveKeys('correct horse battery staple', salt);
    const data = { hello: 'mundo', amounts: [3250, -1000], nested: { ok: true } };
    const blob = await encryptPayload(keys.encKey, vault, data);
    expect(blob[0]).toBe(1);
    expect(new TextDecoder().decode(blob)).not.toContain('mundo');
    const again = await deriveKeys('correct horse battery staple', salt);
    expect(await decryptPayload(again.encKey, vault, blob)).toEqual(data);
  });

  it('uses a fresh IV for every upload', async () => {
    const keys = await deriveKeys('pass phrase here', newSalt(), FAST);
    const a = await encryptPayload(keys.encKey, 'v', { x: 1 });
    const b = await encryptPayload(keys.encKey, 'v', { x: 1 });
    expect(toBase64Url(a.slice(1, 13))).not.toBe(toBase64Url(b.slice(1, 13)));
  });

  it('fails with the wrong passphrase', async () => {
    const salt = newSalt();
    const right = await deriveKeys('the right passphrase', salt, FAST);
    const wrong = await deriveKeys('the wrong passphrase', salt, FAST);
    const blob = await encryptPayload(right.encKey, 'vault', { secret: 42 });
    await expect(decryptPayload(wrong.encKey, 'vault', blob)).rejects.toBeInstanceOf(
      DecryptionError,
    );
  });

  it('fails for a different salt, another vault id or tampered bytes', async () => {
    const keys = await deriveKeys('same passphrase', 'AAAAAAAAAAAAAAAAAAAAAA', FAST);
    const other = await deriveKeys('same passphrase', 'BBBBBBBBBBBBBBBBBBBBBB', FAST);
    const blob = await encryptPayload(keys.encKey, 'vault-a', { secret: 42 });
    await expect(decryptPayload(other.encKey, 'vault-a', blob)).rejects.toThrow(DecryptionError);
    await expect(decryptPayload(keys.encKey, 'vault-b', blob)).rejects.toThrow(DecryptionError);
    const tampered = blob.slice();
    tampered[tampered.length - 1]! ^= 1;
    await expect(decryptPayload(keys.encKey, 'vault-a', tampered)).rejects.toThrow(DecryptionError);
    await expect(decryptPayload(keys.encKey, 'vault-a', new Uint8Array(5))).rejects.toThrow(
      DecryptionError,
    );
  });

  it('derives a stable auth token that differs per vault and passphrase', async () => {
    const salt = newSalt();
    const a = await deriveKeys('passphrase one', salt, FAST);
    const b = await deriveKeys('passphrase one', salt, FAST);
    const c = await deriveKeys('passphrase two', salt, FAST);
    expect(await authToken(a.authKey, 'v1')).toBe(await authToken(b.authKey, 'v1'));
    expect(await authToken(a.authKey, 'v1')).not.toBe(await authToken(a.authKey, 'v2'));
    expect(await authToken(a.authKey, 'v1')).not.toBe(await authToken(c.authKey, 'v1'));
    expect(await sha256Hex(await authToken(a.authKey, 'v1'))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps keys non-extractable', async () => {
    const keys = await deriveKeys('passphrase', newSalt(), FAST);
    expect(keys.encKey.extractable).toBe(false);
    expect(keys.authKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', keys.encKey)).rejects.toThrow();
  });
});

describe('passphrase strength', () => {
  it.each(['123456', 'password', 'senha123', 'aaaaaaaaaaaaaaaa', 'Abc12345!'])(
    'rejects %s',
    (p) => {
      expect(passphraseStrength(p).acceptable).toBe(false);
    },
  );

  it.each([
    'correct horse battery staple',
    'Tr0ub4dor&3-xyzzy-Ql!',
    'café-bicicleta-nuvem-laranja',
  ])('accepts %s', (p) => {
    const s = passphraseStrength(p);
    expect(s.acceptable).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(3);
  });
});
