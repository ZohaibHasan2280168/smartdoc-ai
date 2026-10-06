/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.INTERNAL_BACKEND_URL || 
      (process.env.NODE_ENV === 'production' && process.env.KUBERNETES_SERVICE_HOST 
        ? 'http://backend.smartdoc-ai.svc.cluster.local:8000' 
        : 'http://localhost:8000');
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/docs',
        destination: `${backendUrl}/docs`,
      },
      {
        source: '/metrics',
        destination: `${backendUrl}/metrics`,
      },
      {
        source: '/openapi.json',
        destination: `${backendUrl}/openapi.json`,
      },
    ];
  },
};

module.exports = nextConfig;
