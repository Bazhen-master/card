/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // По умолчанию тело server action ограничено 1 МБ — этого не хватает
      // на загрузку изображений карт из админки.
      bodySizeLimit: "25mb",
    },
  },
};

module.exports = nextConfig;
