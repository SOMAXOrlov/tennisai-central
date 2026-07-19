import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../env";

/** Sign a short access token carrying the user id in `sub`. */
export function signToken(userId: string): string {
  const opts: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign({ sub: userId }, env.jwtSecret, opts);
}

/** Verify a token and return the user id, or null if invalid/expired. */
export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { sub?: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

/** Pull a Bearer token out of an Authorization header. */
export function bearerFrom(header: string | undefined): string {
  if (!header) return "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
