"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/ventas/nueva", etiqueta: "Vender", icono: "🧾" },
  { href: "/ventas", etiqueta: "Ventas", icono: "📋" },
  { href: "/productos", etiqueta: "Productos", icono: "📦" },
  { href: "/clientes", etiqueta: "Clientes", icono: "👥" },
  { href: "/reportes", etiqueta: "Reportes", icono: "📊" },
  { href: "/configuracion", etiqueta: "Ajustes", icono: "⚙️" },
];

// "/ventas" y "/ventas/nueva" comparten prefijo: hay que evitar que ambos
// enlaces del menú se marquen activos al mismo tiempo.
function esEnlaceActivo(pathname: string, href: string): boolean {
  if (href === "/ventas") {
    return pathname === "/ventas" || (pathname.startsWith("/ventas/") && !pathname.startsWith("/ventas/nueva"));
  }
  return pathname.startsWith(href);
}

export function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Escritorio / tablet: menú lateral */}
      <nav className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <ul className="space-y-1">
          {ENLACES.map((enlace) => {
            const activo = esEnlaceActivo(pathname, enlace.href);
            return (
              <li key={enlace.href}>
                <Link
                  href={enlace.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activo
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span aria-hidden>{enlace.icono}</span>
                  {enlace.etiqueta}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Celular: barra inferior de pestañas */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white md:hidden">
        {ENLACES.map((enlace) => {
          const activo = esEnlaceActivo(pathname, enlace.href);
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                activo ? "text-primary-600" : "text-slate-500"
              }`}
            >
              <span aria-hidden className="text-lg">
                {enlace.icono}
              </span>
              {enlace.etiqueta}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
