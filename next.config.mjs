/** @type {import('next').NextConfig} */
const cacheImmutable = "public, max-age=31536000, immutable";
const cacheStaticRevalidate = "public, max-age=86400, stale-while-revalidate=604800";
const cacheShortRevalidate = "public, max-age=3600, stale-while-revalidate=86400";
const cacheNoStore = "no-store, no-cache, must-revalidate, proxy-revalidate";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: cacheImmutable },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: cacheStaticRevalidate },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: cacheStaticRevalidate },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: cacheShortRevalidate },
        ],
      },
      {
        source: "/icon.png",
        headers: [
          { key: "Cache-Control", value: cacheShortRevalidate },
        ],
      },
      {
        source: "/apple-icon.png",
        headers: [
          { key: "Cache-Control", value: cacheShortRevalidate },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: cacheNoStore },
        ],
      },
      {
        source: "/:path((?!_next/static|images/|icons/|api/|manifest\\.json|icon\\.png|apple-icon\\.png).*)",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: cacheNoStore },
        ],
      },
    ];
  },
};

export default nextConfig;
