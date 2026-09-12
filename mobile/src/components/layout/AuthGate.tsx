"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tieneAcceso } from "@/lib/auth";

// Reemplaza al requireAcceso() de Server Components: como acá no hay
// servidor, la comprobación de acceso se hace en el cliente al montar cada
// sección protegida, antes de mostrar nada.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"cargando" | "autorizado">("cargando");

  useEffect(() => {
    let cancelado = false;
    tieneAcceso().then((autorizado) => {
      if (cancelado) return;
      if (!autorizado) {
        router.replace("/login");
        return;
      }
      setEstado("autorizado");
    });
    return () => {
      cancelado = true;
    };
  }, [router]);

  if (estado === "cargando") return null;
  return <>{children}</>;
}
