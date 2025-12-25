import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '6a06d63cb243.ngrok-free.app',
    // Add more ngrok domains here if needed, or use pattern matching
  ],
};

export default nextConfig;
