/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@portico/tokens', '@portico/auth-hub-client', '@portico/ui'],
};
export default nextConfig;
