import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { SplashGate } from "@/components/layout/SplashGate";
import { LicenciaGate } from "@/components/licencia/LicenciaGate";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "MIP",
  description: "Sistema administrativo para vendedores y tiendas pequeñas (offline)",
};

// viewportFit: "cover" habilita env(safe-area-inset-*) en el CSS — la app
// corre dentro de un WebView de Capacitor a pantalla completa (edge-to-edge),
// así que el header y el nav inferior fijo necesitan ese espacio para no
// quedar tapados por la barra de estado o la barra de gestos de Android.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141416",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={archivo.variable}>
      <body className="antialiased">
        <SplashGate>
          <LicenciaGate>{children}</LicenciaGate>
        </SplashGate>
      </body>
    </html>
  );
}
