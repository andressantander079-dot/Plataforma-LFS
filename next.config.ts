import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las server actions reciben fotos y documentos (inscripción de jugadores,
  // firmas de pases): 1 MB por defecto no alcanza → 30 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
