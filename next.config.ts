import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        domains: [
            'firebasestorage.googleapis.com'
        ]
    },
    webpack: (config, { isServer }) => {
        // Provide fallbacks for Node.js core modules when building for the browser
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                buffer: require.resolve('buffer'),
            };
        }
        return config;
    }
};

export default nextConfig;
