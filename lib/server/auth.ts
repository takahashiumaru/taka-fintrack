import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { RowDataPacket } from "mysql2";
import { ensureSchema, getPool } from "./db";

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
};

type TokenPayload = {
  sub: number;
  email: string;
  exp: number;
};

const tokenTtlSeconds = 60 * 60 * 24 * 7;

export function toApiUser(row: UserRow): ApiUser {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
  };
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signAuthToken(user: Pick<ApiUser, "id" | "email">) {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");

  return `${body}.${signature}`;
}

export function verifyAuthToken(token: string) {
  const [body, signature] = token.split(".");

  if (!body || !signature) return null;

  const expectedSignature = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;

    if (!payload.sub || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const payload = verifyAuthToken(token);

  if (!payload) return null;

  await ensureSchema();

  const pool = getPool();
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, name, email, password_hash, avatar_url FROM users WHERE id = ? LIMIT 1",
    [payload.sub],
  );

  return rows[0] ? toApiUser(rows[0]) : null;
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error("AUTH_SECRET minimal 24 karakter di .env.local.");
  }

  return secret;
}
