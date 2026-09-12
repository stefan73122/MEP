"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { db } from "@/lib/db/client";
import { AuthGate } from "@/components/layout/AuthGate";
import { NavBar } from "@/components/layout/NavBar";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { IconAjustes } from "@/components/ui/icons";
import { PagerPrincipal } from "@/components/pager/PagerPrincipal";
import { PANTALLAS_PRINCIPALES } from "@/lib/pantallasPrincipales";
import { sincronizarAlertas } from "@/lib/sincronizarAlertas";

// Mismo quiebre que ya usa NavBar para elegir barra inferior vs. sidebar
// (md:hidden / hidden md:block): el carrusel de swipe solo tiene sentido en
// el layout de celular con barra inferior.
function useEsMobile(): boolean {
  const [esMobile, setEsMobile] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 767px)");
    setEsMobile(consulta.matches);
    const escuchar = (e: MediaQueryListEvent) => setEsMobile(e.matches);
    consulta.addEventListener("change", escuchar);
    return () => consulta.removeEventListener("change", escuchar);
  }, []);

  return esMobile;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const esMobile = useEsMobile();
  const [bloqueoActivo, setBloqueoActivo] = useState(false);

  useEffect(() => {
    db.configuracion.findFirst().then((configuracion) => {
      setBloqueoActivo(!!configuracion?.bloqueoActivado && !!configuracion?.pinHash);
    });
  }, []);

  // Igual que el componentDidMount/componentDidUpdate del diseño original:
  // cada vez que aparece una alerta nueva en el DOM (cambio de pantalla,
  // datos que terminan de cargar, swipe entre vecinas...) se resincroniza
  // su fase con las que ya estaban, así laten todas juntas.
  useEffect(() => {
    sincronizarAlertas();
    const observer = new MutationObserver(() => sincronizarAlertas());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // El carrusel solo reemplaza el contenido en las 5 rutas principales; las
  // sub-rutas (detalle, nuevo, configuración, la lista de ventas...) siguen
  // navegando normal, tal cual hoy.
  const esRutaDelCarrusel = PANTALLAS_PRINCIPALES.some((p) => p.href === pathname);
  const usarCarrusel = esMobile && esRutaDelCarrusel;

  return (
    <AuthGate>
      <div className="flex min-h-screen flex-col md:flex-row">
        <NavBar />

        <div className="flex flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:pt-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- sin optimización de imágenes, es una export estática sin servidor */}
            <img src="/logo-mip.png" alt="MIP" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-tight font-bold text-slate-900">MIP</p>
              <p className="truncate text-xs leading-tight text-slate-500">Mi Inventario Personal</p>
            </div>
            <Link
              href="/configuracion"
              aria-label="Ajustes"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <IconAjustes className="h-5 w-5" />
            </Link>
            {bloqueoActivo && <LogoutButton />}
          </header>

          <main className="flex-1 px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4">
            {usarCarrusel ? <PagerPrincipal /> : children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
