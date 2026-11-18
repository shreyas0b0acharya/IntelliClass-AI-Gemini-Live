import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  allowedDevOrigins: ['10.106.208.26', '10.232.88.26'],
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  experimental: {
    optimizePackageImports: [
      '@react-three/fiber',
      '@react-three/drei',
      'three',
      'lucide-react',
      'sonner',
    ],
  },
  async rewrites() {
    const cdnBase = "https://hdfjiclsjuayuxopgbpf.supabase.co/storage/v1/object/public/3d-assets";
    return [
      {
        source: "/models/:path*",
        destination: `${cdnBase}/models/:path*`,
      },
      {
        source: "/animations/:path*",
        destination: `${cdnBase}/animations/:path*`,
      },
    ];
  },
};

export default nextConfig;
