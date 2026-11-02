import { useMemo, type ComponentType } from "react";
import {
  IconClientes,
  IconInicio,
  IconProductos,
  IconReportes,
  IconServicios,
  IconVender,
} from "@/components/ui/icons";
import type { FiltroPantalla } from "@/components/pager/PagerContext";
import type { TipoNegocio } from "@/lib/db/types";
import { textosDe, useTipoNegocio } from "@/lib/tipoNegocio";
import TableroPage from "@/app/(dashboard)/page";
import { NuevaVentaPage } from "@/app/(dashboard)/ventas/nueva/page";
import { ProductosContenido } from "@/app/(dashboard)/productos/page";
import { ServiciosContenido } from "@/app/(dashboard)/servicios/page";
import { ClientesContenido } from "@/app/(dashboard)/clientes/page";
import { ReportesContenido } from "@/app/(dashboard)/reportes/page";

export type PantallaPrincipal = {
  href: string;
  etiqueta: string;
  Icono: ComponentType<{ className?: string }>;
  // Componente real de la pantalla (sin useSearchParams): lo usa el
  // carrusel para montar la pantalla actual y sus vecinas directamente,
  // sin pasar por la resolución de rutas de Next.
  Componente: ComponentType<{ filtroInicial?: FiltroPantalla }>;
  alerta?: "productos" | "clientes";
};

// Orden canónico de las 5 pantallas principales — el mismo tanto para la
// barra de navegación (NavBar) como para el carrusel de swipe (PagerPrincipal).
// En modo servicios la tercera pestaña es Servicios; Productos sigue
// existiendo (se entra desde Servicios) pero ya no ocupa una pestaña.
export function obtenerPantallasPrincipales(tipo: TipoNegocio): PantallaPrincipal[] {
  const textos = textosDe(tipo);
  const catalogo: PantallaPrincipal =
    tipo === "servicios"
      ? { href: "/servicios", etiqueta: "Servicios", Icono: IconServicios, Componente: ServiciosContenido }
      : {
          href: "/productos",
          etiqueta: "Productos",
          Icono: IconProductos,
          Componente: ProductosContenido,
          alerta: "productos",
        };

  return [
    { href: "/", etiqueta: "Inicio", Icono: IconInicio, Componente: TableroPage },
    { href: "/ventas/nueva", etiqueta: textos.vender, Icono: IconVender, Componente: NuevaVentaPage },
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
