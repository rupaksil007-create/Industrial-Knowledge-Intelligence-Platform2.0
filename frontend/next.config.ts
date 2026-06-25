import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Configure Webpack to use filesystem caching instead of memory to prevent heap bloat
      config.cache = {
        type: 'filesystem',
        maxMemoryGenerations: 2, // aggressively garbage collect old module compilations
      };
    }
    return config;
  },
};

export default nextConfig;
