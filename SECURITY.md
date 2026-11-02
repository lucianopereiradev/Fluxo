# Security

Fluxo is local-first: financial data lives in the browser's IndexedDB and never leaves the
device unless the user turns on sync. This document describes what sync protects against, how,
and where its limits are.

## Reporting a vulnerability

Please open a private security advisory on GitHub
(**Security → Report a vulnerability** in this repository) instead of a public issue.

## Assets

| Asset                                                                              | Where it lives                                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Financial records (accounts, cards, transactions, budgets, goals, rules, settings) | IndexedDB on each device; encrypted blob on the server only if sync is on                    |
| Passphrase                                                                         | Only in the user's head (and a password manager, ideally). Never stored, never sent          |
| `encKey`, `authKey`                                                                | Memory; optionally IndexedDB as non-extractable `CryptoKey`s ("remember on this device")     |
| Access token                                                                       | Derived on demand, sent as a bearer token over HTTPS; only its SHA-256 is stored server side |

## Cryptography

1. `vaultId` = 128 random bits, base64url. `salt` = 16 random bytes.
2. `master = PBKDF2-SHA-256(passphrase (NFKC), salt, 600 000 iterations, 256 bits)`.
3. `encKey = HKDF-SHA-256(master, info "fluxo/v1/enc")` → AES-GCM-256, non-extractable.
   `authKey = HKDF-SHA-256(master, info "fluxo/v1/auth")` → HMAC-SHA-256, non-extractable.
4. `authToken = base64url(HMAC(authKey, vaultId))`; the server stores `SHA-256(authToken)`.
5. Payload = `AES-GCM(encKey, iv = 12 random bytes, aad = vaultId, gzip(JSON snapshot))`,
   framed as `[version byte][iv][ciphertext + tag]`. A new IV is drawn for every upload.

The two keys are independent, so the server-side token hash reveals nothing about the
encryption key, and binding the vault ID as AAD stops a blob from being replayed into another
vault. A minimum passphrase strength (≈60 bits estimated, 12+ characters) is enforced in the UI.

## Threat model

| Threat                                              | Mitigation                                                                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server or database compromise                       | The server only has ciphertext, sizes, versions, timestamps and token hashes. No keys, no passphrase, no plaintext.                                                           |
| Someone learns a vault ID (e.g. from a shared link) | Reading, writing and deleting require the bearer token, which requires the passphrase. The ID and salt are not secrets on their own.                                          |
| Overwriting someone's vault                         | Writes need a valid token **and** the current version (`If-Match`); stale writes get `409`.                                                                                   |
| Token guessing / timing attacks                     | Tokens are 256-bit HMACs; the hash comparison runs in constant time; IP rate limiting on all API routes.                                                                      |
| Tampered or replayed ciphertext                     | AES-GCM authentication with the vault ID as AAD; a failed decryption aborts the sync and never touches local data. Decrypted snapshots are validated with Zod before merging. |
| Oversized uploads / abuse                           | 5 MB blob limit (checked on `Content-Length` and on the body), Zod-validated input, rate limiting with the Workers binding plus an in-memory fallback.                        |
| Cross-site requests (CSRF) and embedding            | Same-origin only: `Origin` must match, cross-site `Sec-Fetch-Site` is refused, no CORS headers; `frame-ancestors 'none'`.                                                     |
| XSS                                                 | Strict CSP (`script-src 'self'`, no inline scripts, `object-src 'none'`), React escaping, no `dangerouslySetInnerHTML`.                                                       |
| Information leaks from errors or logs               | Errors return short codes only; the Worker never logs request bodies or tokens.                                                                                               |
| Passphrase loss                                     | Unrecoverable by design — the UI requires the user to acknowledge it before creating a vault. Local data on each device is unaffected.                                        |

## Out of scope / known limits

- **A compromised device or browser** (malware, a malicious extension) can read IndexedDB and
  memory. Fluxo cannot defend against the device it runs on.
- **"Remember on this device"** keeps non-extractable keys in IndexedDB. They cannot be
  exported as bytes, but code running in the page origin could still use them.
- **Metadata**: the server knows when a vault changes, the blob size and the client IP.
- **Weak passphrases** remain guessable offline by anyone who obtains the blob and salt; the
  strength meter and 600 000 PBKDF2 iterations raise the cost but cannot remove it.
- **Last-writer-wins merging** resolves conflicts per record; simultaneous edits to the same
  record on two devices keep the most recent one.
