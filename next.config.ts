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
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hdfjiclsjuayuxopgbpf.supabase.co";
    return [
      {
        source: "/models/:path*",
        destination: `${supabaseUrl}/storage/v1/object/public/3d-assets/models/:path*`,
      },
      {
        source: "/animations/:path*",
        destination: `${supabaseUrl}/storage/v1/object/public/3d-assets/animations/:path*`,
      },
    ];
  },
};

export default nextConfig;
