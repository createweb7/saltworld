const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  // Renamed from experimental.serverComponentsExternalPackages in Next 15
  serverExternalPackages: ['mongodb'],
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async redirects() {
    // Better Sleep + Mental Wellness were merged into one outcome page.
    return [
      { source: '/outcomes/better-sleep',   destination: '/outcomes/sleep-mental-clarity', permanent: true },
      { source: '/outcomes/mental-wellness', destination: '/outcomes/sleep-mental-clarity', permanent: true },
    ];
  },
  async headers() {
    const baseHeaders = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self';" },
    ];
    // Same-origin calls never need CORS headers. Only set them when an
    // external origin has been explicitly whitelisted via CORS_ORIGINS
    // (comma-separated), e.g. for a separate marketing site or mobile app
    // calling this API from the browser.
    const corsOrigin = process.env.CORS_ORIGINS?.split(',')[0]?.trim();
    const headers = corsOrigin
      ? [
          ...baseHeaders,
          { key: "Access-Control-Allow-Origin", value: corsOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ]
      : baseHeaders;
    return [{ source: "/(.*)", headers }];
  },
};

module.exports = nextConfig;
