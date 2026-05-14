/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // In Docker: API_GATEWAY_URL is set to http://api-gateway:8080
    // In local dev: falls back to http://localhost:8080
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/:path*',
        destination: `${apiGatewayUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
