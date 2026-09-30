/**
 * Builds an absolute URL against the public SITE_URL rather than req.url's
 * own origin. On Netlify, req.url resolves to the internal per-deploy
 * *.netlify.app hostname rather than the custom domain the visitor actually
 * used, so redirects built from it send guests to the wrong host (and drop
 * their session cookie, which is scoped to the real domain). Vercel doesn't
 * have this problem, but preferring SITE_URL everywhere a redirect target is
 * built costs nothing there and fixes it on Netlify.
 */
export function absoluteUrl(path: string, req: Request): URL {
  const base = process.env.SITE_URL || req.url;
  return new URL(path, base);
}
