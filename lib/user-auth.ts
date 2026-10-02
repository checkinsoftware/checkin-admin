import { SignJWT, jwtVerify } from "jose";

export const USER_COOKIE = "checkin_user";
// Effectively permanent — the guest stays logged in until they explicitly tap
// Logout (leaving/closing the page never logs out). Browsers cap cookie age at
// ~400 days, so 365 keeps it valid for a year and quietly renews on each visit.
const DAYS = 365;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is missing");
  return new TextEncoder().encode(secret);
}

// A magic-link login is a shared-link login, so it ends after a week. OTP and password
// logins are the guest's own and stay until they tap Logout.
const MAGIC_DAYS = 7;

export type UserSession = { mobile: string; role: "user"; magic?: boolean };

export async function createUserToken(mobile: string, opts: { magic?: boolean } = {}) {
  const claims: Record<string, unknown> = { mobile, role: "user" };
  if (opts.magic) claims.magic = true;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${opts.magic ? MAGIC_DAYS : DAYS}d`)
    .sign(key());
}

export async function verifyUserToken(token?: string): Promise<UserSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.role !== "user" || typeof payload.mobile !== "string") return null;
    return { mobile: payload.mobile, role: "user", magic: payload.magic === true };
  } catch {
    return null;
  }
}

export const userCookieMaxAge = DAYS * 24 * 60 * 60;
export const magicCookieMaxAge = MAGIC_DAYS * 24 * 60 * 60;
