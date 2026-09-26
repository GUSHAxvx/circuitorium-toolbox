import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

// 登录令牌的签名密钥。
// 以前这里写死了一个兜底值 'your-secret-key-change-in-production'——那等于"密钥公开"：
// 只要忘了在 .env 里配 JWT_SECRET，任何人都能自己造一个令牌冒充别人。
// 现在改成：生产环境没配就用本次运行随机的密钥（重启后需要重新登录），并明确警告。
const ENV_SECRET = process.env.JWT_SECRET;
if (!ENV_SECRET && process.env.NODE_ENV === 'production') {
  console.warn(
    '[安全] 没有设置 JWT_SECRET：本次运行使用随机密钥，重启后所有人需要重新登录。' +
    '请在 .env 里设置 JWT_SECRET（见 .env.example）。'
  );
}
const JWT_SECRET = ENV_SECRET
  || (process.env.NODE_ENV === 'production'
    ? randomBytes(32).toString('hex')
    : 'dev-only-secret-not-for-production');

// bcrypt 计算耗时，使用异步版本避免阻塞 Node 事件循环
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

export function getTokenFromHeader(authHeader: string | null): { userId: number } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}
