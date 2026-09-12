import path from "node:path";
import type { NextConfig } from "next";

// App 100% estática: se empaqueta con Capacitor y corre sin servidor.
// Sin Server Actions, sin Route Handlers dinámicos, sin optimización de
// imágenes en servidor (no hay servidor).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    // Evita que Next confunda esta carpeta con el proyecto raíz (ambos
    // tienen su propio package-lock.json mientras dura la migración).
    root: path.join(__dirname),
  },
};

export default nextConfig;
