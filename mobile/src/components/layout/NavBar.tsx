"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { db } from "@/lib/db/client";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import { obtenerLotesPorVencer, obtenerLotesVencidos } from "@/lib/lotes";
import { obtenerCuentasPorCobrar } from "@/lib/creditos";
import {
  IconAjustes,
  IconAlertaBandera,
  IconClientes,
  IconProductos,
  IconReportes,
  IconVender,
  IconVentas,
} from "@/components/ui/icons";

const ENLACES = [
  { href: "/ventas/nueva", etiqueta: "Vender", Icono: IconVender },
  { href: "/ventas", etiqueta: "Ventas", Icono: IconVentas },
  { href: "/productos", etiqueta: "Productos", Icono: IconProductos, alerta: "productos" as const },
  { href: "/clientes", etiqueta: "Clientes", Icono: IconClientes, alerta: "clientes" as const },
  { href: "/reportes", etiqueta: "Reportes", Icono: IconReportes },
  { href: "/configuracion", etiqueta: "Ajustes", Icono: IconAjustes },
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
  const [alertas, setAlertas] = useState({ productos: false, clientes: false });

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [configuracion, productos, cuentasPorCobrar] = await Promise.all([
        db.configuracion.findFirst(),
        db.producto.findMany({ activo: true }),
        obtenerCuentasPorCobrar(db),
      ]);
      const diasAlerta = configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO;
      const [lotesVencidos, lotesPorVencer] = await Promise.all([
        obtenerLotesVencidos(db),
        obtenerLotesPorVencer(db, diasAlerta),
      ]);
      if (cancelado) return;
      const hayStockBajo = productos.some((p) => p.stockActual < p.stockMinimo);
      setAlertas({
        productos: hayStockBajo || lotesVencidos.length > 0 || lotesPorVencer.length > 0,
        clientes: cuentasPorCobrar.length > 0,
      });
    }
    cargar();
    return () => {
      cancelado = true;
    };
    // Se recalcula al cambiar de pantalla para reflejar cambios recién guardados.
  }, [pathname]);

  return (
    <>
      {/* Escritorio / tablet: menú lateral */}
      <nav className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <ul className="space-y-1">
          {ENLACES.map(({ href, etiqueta, Icono, alerta }) => {
            const activo = esEnlaceActivo(pathname, href);
            const conAlerta = alerta ? alertas[alerta] : false;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold uppercase tracking-wide transition ${
                    activo
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icono className="h-4 w-4" />
                  {etiqueta}
                  {conAlerta && (
                    <span className="ml-auto">
                      <IconAlertaBandera className="h-4 w-4" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Celular: barra inferior de pestañas */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch gap-0.5 border-t border-slate-200 bg-white px-2 pt-1.5 pb-2 md:hidden">
        {ENLACES.map(({ href, etiqueta, Icono, alerta }) => {
          const activo = esEnlaceActivo(pathname, href);
          const conAlerta = alerta ? alertas[alerta] : false;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 -skew-x-[8deg] flex-col items-center justify-center gap-1 rounded-lg py-2 transition ${
                activo ? "bg-primary-500 shadow-[0_3px_0_#a57e00]" : ""
              }`}
            >
              {conAlerta && (
                <span className="absolute top-0.5 right-1">
                  <IconAlertaBandera contexto="nav" className="h-[18px] w-[18px]" />
                </span>
              )}
              <Icono className={`skew-x-[8deg] ${activo ? "text-black" : "text-slate-500"}`} />
              <span
                className={`skew-x-[8deg] text-[11px] font-semibold ${
                  activo ? "text-black" : "text-slate-500"
                }`}
              >
                {etiqueta}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
