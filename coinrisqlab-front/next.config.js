/** @type {import('next').NextConfig} */

const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 's2.coinmarketcap.com',
                pathname: '/static/img/coins/**',
            },
            {
                protocol: 'https',
                hostname: 'coin-images.coingecko.com',
                pathname: '/coins/images/**',
            }
        ],
    },
};

module.exports = nextConfig;
