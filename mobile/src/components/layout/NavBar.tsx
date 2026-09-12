"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { db } from "@/lib/db/client";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import { PANTALLAS_PRINCIPALES } from "@/lib/pantallasPrincipales";
import { IconAlertaBandera } from "@/components/ui/icons";
import { usePagerContext } from "@/components/pager/PagerContext";
import { useTecladoAbierto } from "@/lib/useTecladoAbierto";

// "/" (Inicio) sólo debe marcarse activo en la raíz exacta: con startsWith
// a secas, cualquier ruta (todas empiezan con "/") quedaría marcada.
function esEnlaceActivo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function NavBar() {
  const pathname = usePathname();
  const pager = usePagerContext();
  const tecladoAbierto = useTecladoAbierto();
  const [alertas, setAlertas] = useState({ productos: false, clientes: false });

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const ahora = new Date();
      const configuracion = await db.configuracion.findFirst();
      const diasAlerta = configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO;
      // Todo agregado en SQLite (COUNT/SUM): nunca trae productos, lotes ni
      // ventas a memoria sólo para contarlos, así que no importa cuántas
      // filas tengan esas tablas.
      const [stockBajo, vencidos, porVencer, fiadoPendiente] = await Promise.all([
        db.producto.contarStockBajo(),
        db.lote.contarProductosVencidos(ahora),
        db.lote.contarProductosPorVencer(ahora, diasAlerta),
        db.venta.saldoPendienteTotalCredito(),
      ]);
      if (cancelado) return;
      setAlertas({
        productos: stockBajo > 0 || vencidos > 0 || porVencer > 0,
        clientes: fiadoPendiente > 0,
      });
    }
    cargar();
    return () => {
      cancelado = true;
    };
    // Se recalcula al cambiar de pantalla para reflejar cambios recién guardados.
  }, [pathname]);

  // Índice "en vivo" para la pestaña activa: mientras se arrastra el
  // carrusel, se mueve en sincronía con el dedo (indiceActivo + progreso);
  // fuera del carrusel (o sin arrastre), es simplemente el índice actual.
  const indiceEnVivo = pager ? pager.indiceActivo + pager.progreso : null;

  return (
    <>
      {/* Escritorio / tablet: menú lateral */}
      <nav className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
        <ul className="space-y-1">
          {PANTALLAS_PRINCIPALES.map(({ href, etiqueta, Icono, alerta }) => {
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

      {/* Celular: barra inferior de pestañas.
          Se esconde deslizándose hacia abajo mientras el teclado está
          abierto (si no, queda flotando encima tapando contenido) y vuelve
          a subir sola al cerrarse. */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-10 flex items-stretch gap-0.5 border-t border-slate-200 bg-white px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] transition-transform duration-200 md:hidden ${
          tecladoAbierto ? "translate-y-full" : "translate-y-0"
        }`}
      >
        {PANTALLAS_PRINCIPALES.map(({ href, etiqueta, Icono, alerta }, indice) => {
          const activo = indiceEnVivo !== null ? Math.round(indiceEnVivo) === indice : esEnlaceActivo(pathname, href);
          // Mientras se arrastra, la intensidad del resaltado sigue al dedo
          // en vez de saltar de golpe (0 = lejos, 1 = pestaña activa).
          const intensidad = indiceEnVivo !== null ? Math.max(0, 1 - Math.abs(indiceEnVivo - indice)) : activo ? 1 : 0;
          const conAlerta = alerta ? alertas[alerta] : false;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 -skew-x-[8deg] flex-col items-center justify-center gap-1 rounded-lg py-2"
              style={{
                backgroundColor: intensidad > 0 ? `rgba(255,213,36,${intensidad})` : "transparent",
                boxShadow: intensidad > 0.5 ? "0 3px 0 #a57e00" : "none",
                transition: pager?.progreso ? "none" : "background-color 200ms, box-shadow 200ms",
              }}
            >
              {conAlerta && (
                <span className="absolute top-0.5 right-1">
                  <IconAlertaBandera contexto="nav" className="h-[20px] w-[21px]" />
                </span>
              )}
              <Icono className={`skew-x-[8deg] ${intensidad > 0.5 ? "text-black" : "text-slate-500"}`} />
              <span
                className={`skew-x-[8deg] text-[11px] font-semibold ${
                  intensidad > 0.5 ? "text-black" : "text-slate-500"
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
