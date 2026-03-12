/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Keep next/image usable without requiring Cloudflare Images bindings.
    // If you enable Cloudflare image optimization later, remove this.
    unoptimized: true,
  },
};

export default nextConfig;

// Enables better local dev parity when using OpenNext + Wrangler.
import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
