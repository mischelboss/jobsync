/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  devIndicators: false,
  // imapflow/mailparser use dynamic requires the bundler can't follow; keep them
  // external so they're loaded from node_modules and traced into the standalone
  // build (email-alert automations need them at runtime).
  serverExternalPackages: ["pdf-parse", "imapflow", "mailparser"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
