#!/usr/bin/env node
// Encrypts the Confidential Projects tab content so the published asset
// (assets/confidential-projects.json) never contains plaintext — only an
// AES-GCM ciphertext derived from a password via PBKDF2. The matching
// decrypt logic lives in assets/confidential-gate.js and MUST stay in sync
// with the algorithm/iteration constants below.
//
// Usage:
//   node scripts/encrypt-confidential.js <password> [contentFile] [outputFile]
//
// Defaults:
//   contentFile = scripts/confidential-content.local.json  (gitignored, plaintext source)
//   outputFile  = assets/confidential-projects.json        (committed, ciphertext only)

const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

const ITERATIONS = 200000;
const HASH = 'SHA-256';
const SALT_BYTES = 16;
const IV_BYTES = 12;

function toBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

async function deriveKey(password, salt) {
  const passKey = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
}

async function main() {
  const [password, contentFileArg, outputFileArg] = process.argv.slice(2);

  if (!password) {
    console.error('Usage: node scripts/encrypt-confidential.js <password> [contentFile] [outputFile]');
    process.exit(1);
  }

  const contentFile = path.resolve(contentFileArg || 'scripts/confidential-content.local.json');
  const outputFile = path.resolve(outputFileArg || 'assets/confidential-projects.json');

  if (!fs.existsSync(contentFile)) {
    console.error(`Content file not found: ${contentFile}`);
    console.error('Create it (plaintext, gitignored) before encrypting. See README for the expected shape.');
    process.exit(1);
  }

  const raw = fs.readFileSync(contentFile, 'utf8');
  // Validate it's real JSON before encrypting garbage.
  JSON.parse(raw);

  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);

  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(raw),
  );

  const payload = {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };

  fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Encrypted ${contentFile} -> ${outputFile}`);
  console.log('Remember: only the encrypted output should ever be committed.');
}

main().catch((error) => {
  console.error('Encryption failed:', error);
  process.exit(1);
});
