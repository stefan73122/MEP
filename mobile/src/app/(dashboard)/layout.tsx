"use client";

import { useEffect, useState } from "react";
import { pinConfigurado } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { AuthGate } from "@/components/layout/AuthGate";
import { NavBar } from "@/components/layout/NavBar";
import { LogoutButton } from "@/components/layout/LogoutButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [nombreNegocio, setNombreNegocio] = useState("Mi Tienda");
  const [hayPin, setHayPin] = useState(false);

  useEffect(() => {
    Promise.all([db.configuracion.findFirst(), pinConfigurado()]).then(([configuracion, pin]) => {
      if (configuracion?.nombreNegocio) setNombreNegocio(configuracion.nombreNegocio);
      setHayPin(pin);
    });
  }, []);

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
            {hayPin && <LogoutButton />}
          </header>

          <main className="flex-1 px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
