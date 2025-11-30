/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
        pathname: "/**",
      },
    ],
  },

  // ⬇️ FIX IMPORTANTISSIMO: NON bundlare playwright-core
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        "playwright-core", 
        "@sparticuz/chromium-min"
      );
    }

    return config;
  },
};

module.exports = nextConfig;
