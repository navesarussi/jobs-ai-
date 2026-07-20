import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the file-parsing libs out of the server bundle (they use Node built-ins
  // and ship their own workers/assets).
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
