-- Encrypted sync vaults. The server only ever stores ciphertext.
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  auth_hash TEXT NOT NULL,
  version INTEGER NOT NULL,
  blob BLOB,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
