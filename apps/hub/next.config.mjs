/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The monorepo symlinks packages/* — tell Next to follow them so @portico/ui
  // resolves to source instead of a stale copy.
  transpilePackages: ['@portico/tokens', '@portico/auth-hub-client', '@portico/ui'],
};

export default nextConfig;
