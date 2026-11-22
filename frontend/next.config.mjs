const backendHost = process.env.BACKEND_INTERNAL_URL;
const backendOrigin = backendHost
  ? `http://${backendHost}`
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.INSTACHEF_BUILD_DIR || '.next',
  async rewrites() {
    return [
      {
        source: '/_backend/:path*',
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
