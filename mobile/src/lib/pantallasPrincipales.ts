import { useMemo, type ComponentType } from "react";
import {
  IconClientes,
  IconInicio,
  IconProductos,
  IconReportes,
  IconServicios,
  IconVender,
  IconVentas,
} from "@/components/ui/icons";
import type { FiltroPantalla } from "@/components/pager/PagerContext";
import type { TipoNegocio } from "@/lib/db/types";
import { textosDe, useTipoNegocio } from "@/lib/tipoNegocio";
import TableroPage from "@/app/(dashboard)/page";
import { NuevaVentaPage } from "@/app/(dashboard)/ventas/nueva/page";
import { HistorialContenido } from "@/app/(dashboard)/ventas/page";
import { CatalogoContenido } from "@/components/catalogo/CatalogoContenido";
import { ClientesContenido } from "@/app/(dashboard)/clientes/page";
import { ReportesContenido } from "@/app/(dashboard)/reportes/page";

export type PantallaPrincipal = {
  href: string;
  // Otra ruta que muestra esta misma pestaña (la del catálogo responde a
  // /productos y a /servicios, porque las dos listas viven en ella).
  alias?: string;
  etiqueta: string;
  Icono: ComponentType<{ className?: string }>;
  // Componente real de la pantalla (sin useSearchParams): lo usa el
  // carrusel para montar la pantalla actual y sus vecinas directamente,
  // sin pasar por la resolución de rutas de Next.
  Componente: ComponentType<{ filtroInicial?: FiltroPantalla }>;
  alerta?: "productos" | "clientes";
};

// Orden canónico de las 6 pantallas principales — el mismo tanto para la
// barra de navegación (NavBar) como para el carrusel de swipe (PagerPrincipal).
// La pestaña del catálogo tiene un selector "Servicios | Productos" (o
// "Productos | Servicios" en modo tienda) para cambiar de lista sin salir.
export function obtenerPantallasPrincipales(tipo: TipoNegocio): PantallaPrincipal[] {
  const textos = textosDe(tipo);
  const catalogo: PantallaPrincipal =
    tipo === "servicios"
      ? {
          href: "/servicios",
          alias: "/productos",
          etiqueta: "Servicios",
          Icono: IconServicios,
          Componente: CatalogoContenido,
          alerta: "productos",
        }
      : {
          href: "/productos",
          alias: "/servicios",
          etiqueta: "Productos",
          Icono: IconProductos,
          Componente: CatalogoContenido,
          alerta: "productos",
        };

  return [
    { href: "/", etiqueta: "Inicio", Icono: IconInicio, Componente: TableroPage },
    { href: "/ventas/nueva", etiqueta: textos.vender, Icono: IconVender, Componente: NuevaVentaPage },
    { href: "/ventas", etiqueta: "Historial", Icono: IconVentas, Componente: HistorialContenido },
    catalogo,
    {
      href: "/clientes",
      etiqueta: "Clientes",
      Icono: IconClientes,
      Componente: ClientesContenido,
      alerta: "clientes",
    },
    { href: "/reportes", etiqueta: "Reportes", Icono: IconReportes, Componente: ReportesContenido },
  ];
}

export function usePantallasPrincipales(): PantallaPrincipal[] {
  const { tipo } = useTipoNegocio();
  return useMemo(() => obtenerPantallasPrincipales(tipo), [tipo]);
}

// Índice de la pestaña que es exactamente esta ruta (o -1).
export function indicePantalla(pantallas: PantallaPrincipal[], ruta: string): number {
  return pantallas.findIndex((p) => p.href === ruta || p.alias === ruta);
}

export function esPantallaPrincipal(pantallas: PantallaPrincipal[], ruta: string): boolean {
  return indicePantalla(pantallas, ruta) !== -1;
}

// Pestaña a resaltar en cualquier ruta, incluidos detalles y formularios:
// la de prefijo más largo (así /ventas/detalle marca Historial y
// /ventas/nueva marca Vender, aunque las dos empiecen con /ventas).
export function indicePestanaActiva(pantallas: PantallaPrincipal[], ruta: string): number {
  let mejor = -1;
  let largoMejor = -1;
  pantallas.forEach((p, indice) => {
    for (const base of [p.href, p.alias]) {
      if (!base) continue;
      const coincide = base === "/" ? ruta === "/" : ruta === base || ruta.startsWith(`${base}/`);
      if (coincide && base.length > largoMejor) {
        mejor = indice;
        largoMejor = base.length;
      }
    }
  });
  return mejor;
}
