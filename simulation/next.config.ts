import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    // The Anthropic SDK imports "node:" prefixed modules, which webpack does not
    // handle in client bundles. Strip the prefix and stub out the node built-ins
    // (the SDK only touches them in non-browser code paths).
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
