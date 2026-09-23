import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "BuildKhata",
  description: "Builder project expense book — payments, material and labour with category-wise totals.",
  manifest: "/build/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BuildKhata" },
  icons: { icon: "/build/icon.svg", apple: "/build/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#A85B0C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return children;
}
