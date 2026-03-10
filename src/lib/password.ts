import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const passwordHash = scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(hash, 'hex');

  if (passwordHash.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(passwordHash, storedHashBuffer);
}
