import { describe, expect, it } from 'vitest';
import { pairingLink, parsePairing } from './engine';

const ID = 'AbCdEfGhIjKlMnOpQrStUv';
const SALT = 'saltSALTsaltSALTsalt12';

describe('pairing links', () => {
  it('keeps the vault id and salt in the URL fragment only', () => {
    const link = pairingLink(ID, SALT, 'https://fluxo.test');
    const url = new URL(link);
    expect(url.pathname).toBe('/app/settings');
    expect(url.search).toBe('');
    expect(url.hash).toBe(`#pair&v=${ID}&s=${SALT}`);
  });

  it('parses full links, bare fragments and plain vault ids', () => {
    expect(parsePairing(pairingLink(ID, SALT, 'https://fluxo.test'))).toEqual({
      vaultId: ID,
      salt: SALT,
    });
    expect(parsePairing(`#pair&v=${ID}`)).toEqual({ vaultId: ID, salt: undefined });
    expect(parsePairing(`  ${ID} `)).toEqual({ vaultId: ID, salt: undefined });
  });

  it('rejects anything else', () => {
    expect(parsePairing('https://example.com')).toBeNull();
    expect(parsePairing('#pair&v=short')).toBeNull();
    expect(parsePairing('')).toBeNull();
  });
});
