import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Tienda",
  description: "Sistema administrativo para vendedores y tiendas pequeñas (offline)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
