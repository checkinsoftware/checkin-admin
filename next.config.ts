import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // db/*.sql is read at runtime by the db-setup route, so keep it in the bundle.
  outputFileTracingIncludes: {
    "/api/admin/db-setup": ["./db/**"],
  },
  // checkin.co.in shows the marketing site; the guest login lives on it as a
  // widget (public/guest-widget.js). Admin-guess URLs go home.
  async rewrites() {
    return [
      { source: "/", destination: "/index.html" },
      // The guest SMS-notifications view has its own URL; it renders on the same
      // page (the widget opens the SMS view when the path is /sms).
      { source: "/sms", destination: "/index.html" },
      // Magic-link landing (thank-you + notification opt-in) — same page, the
      // widget shows the welcome view when the path is /welcome.
      { source: "/welcome", destination: "/index.html" },
    ];
  },
  // Baseline hardening for everything Next serves (pages, admin, APIs). The same
  // headers are in netlify.toml for the static files the CDN serves directly.
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ];
    return [
      { source: "/:path*", headers: base },
      // Admin and API responses carry private data: never cache, never index.
      {
        source: "/mng-x7k9/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/", permanent: false },
      { source: "/admin/:path*", destination: "/", permanent: false },
      { source: "/login", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
