"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { tieneAcceso, registrarRebloqueoAlPausar, bloquear } from "@/lib/auth";

// Reemplaza al requireAcceso() de Server Components: como acá no hay
// servidor, la comprobación de acceso se hace en el cliente al montar cada
// sección protegida, antes de mostrar nada.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"cargando" | "autorizado">("cargando");

  useEffect(() => {
    let cancelado = false;

    const verificar = () => {
      setEstado("cargando");
      tieneAcceso().then((autorizado) => {
        if (cancelado) return;
        if (!autorizado) {
          router.replace("/login");
          return;
        }
        setEstado("autorizado");
      });
    };

    verificar();
    registrarRebloqueoAlPausar();

    // Al pasar a segundo plano se oculta el contenido de inmediato (no solo
    // se marca bloqueado para la próxima vez): evita que quede a la vista en
    // el selector de apps de Android mientras la app está pausada.
    const listenerPause = App.addListener("pause", () => {
      bloquear();
      if (!cancelado) setEstado("cargando");
    });
    const listenerResume = App.addListener("resume", () => {
      if (!cancelado) verificar();
    });

    return () => {
      cancelado = true;
      listenerPause.then((h) => h.remove());
      listenerResume.then((h) => h.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (estado === "cargando") return null;
  return <>{children}</>;
}
