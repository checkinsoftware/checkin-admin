import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Separate session for the BuildKhata app (kept apart from the admin/guest
// cookies). Reuses the same SESSION_SECRET.
export const BUILD_COOKIE = "build_session";
const DAYS = 30;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export type BuildSession = { username: string; name: string; role: "build" };

export async function createBuildToken(username: string, name: string): Promise<string> {
  return new SignJWT({ username, name, role: "build" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(key());
}

export async function verifyBuildToken(token?: string): Promise<BuildSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.role !== "build" || typeof payload.username !== "string") return null;
    const name = typeof payload.name === "string" ? payload.name : payload.username;
    return { username: payload.username, name, role: "build" };
  } catch {
    return null;
  }
}

/** Read + verify the current BuildKhata user from the request cookies. */
export async function currentBuildUser(): Promise<BuildSession | null> {
  const store = await cookies();
  return verifyBuildToken(store.get(BUILD_COOKIE)?.value);
}

export const buildCookieMaxAge = DAYS * 24 * 60 * 60;
