/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@portico/tokens', '@portico/auth-hub-client', '@portico/ui'],
  async headers() {
    return [
      {
        // US-A02 AC5 — after logout the Back button must not show app data.
        // Clearing the cookie is not enough: Chrome serves the previous page
        // from bfcache without asking the server. Chrome (116+) excludes any
        // page sent with `no-store` from bfcache, so Back re-requests, hits the
        // session guard, and lands on /login. Applies to every authenticated
        // page, not just the list.
        source: '/apps/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
      {
        source: '/apps',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ];
  },
};
export default nextConfig;
