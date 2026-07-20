const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(length = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = '';
  for (const byte of bytes) {
    result += BASE32_CHARS[byte % 32];
  }
  return result;
}

function base32Decode(encoded: string): Uint8Array {
  const cleaned = encoded.replace(/\s/g, '').toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const msgBuffer = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength) as ArrayBuffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
  return new Uint8Array(sig);
}

export async function generateTOTP(secret: string, timeStep = 30): Promise<string> {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);

  const counterBytes = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }

  const hash = await hmacSha1(key, counterBytes);
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

export async function verifyTOTP(secret: string, token: string, window = 1): Promise<boolean> {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = 30;

  for (let i = -window; i <= window; i++) {
    const counter = Math.floor(epoch / timeStep) + i;
    const counterBytes = new Uint8Array(8);
    let tmp = counter;
    for (let j = 7; j >= 0; j--) {
      counterBytes[j] = tmp & 0xff;
      tmp = Math.floor(tmp / 256);
    }

    const hash = await hmacSha1(key, counterBytes);
    const offset = hash[hash.length - 1] & 0x0f;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;

    if (code.toString().padStart(6, '0') === token) return true;
  }
  return false;
}

export function buildOTPAuthURI(secret: string, account: string, issuer = 'Tirak Chat'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(account);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
