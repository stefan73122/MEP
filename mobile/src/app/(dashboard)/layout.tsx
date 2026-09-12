"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pinConfigurado } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { AuthGate } from "@/components/layout/AuthGate";
import { NavBar } from "@/components/layout/NavBar";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { IconAjustes } from "@/components/ui/icons";
import { PagerPrincipal } from "@/components/pager/PagerPrincipal";
import { PANTALLAS_PRINCIPALES } from "@/lib/pantallasPrincipales";

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
  const [nombreNegocio, setNombreNegocio] = useState("Mi Tienda");
  const [hayPin, setHayPin] = useState(false);

  useEffect(() => {
    Promise.all([db.configuracion.findFirst(), pinConfigurado()]).then(([configuracion, pin]) => {
      if (configuracion?.nombreNegocio) setNombreNegocio(configuracion.nombreNegocio);
      setHayPin(pin);
    });
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500 shadow-[0_2px_0_rgba(0,0,0,0.5)]">
              <span className="text-sm font-black italic tracking-tighter text-black">MT</span>
            </div>
            <p className="flex-1 truncate text-sm font-semibold text-slate-900">{nombreNegocio}</p>
            <Link
              href="/configuracion"
              aria-label="Ajustes"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <IconAjustes className="h-5 w-5" />
            </Link>
            {hayPin && <LogoutButton />}
          </header>

          <main className="flex-1 px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4">
            {usarCarrusel ? <PagerPrincipal /> : children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
