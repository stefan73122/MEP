"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { tieneAcceso, registrarRebloqueoAlPausar, bloquear } from "@/lib/auth";
import { LoginForm } from "@/app/(auth)/login/LoginForm";
import { marcarAppBloqueada } from "@/lib/botonAtras";

// "iniciando": todavía no se comprobó el acceso, no se muestra nada.
// "oculto": la app está (o viene de estar) en segundo plano.
// "bloqueado": volvió de segundo plano y hay que desbloquear con PIN/huella.
type Estado = "iniciando" | "autorizado" | "oculto" | "bloqueado";

// Reemplaza al requireAcceso() de Server Components: como acá no hay
// servidor, la comprobación de acceso se hace en el cliente al montar cada
// sección protegida, antes de mostrar nada.
//
// Una vez adentro, la pantalla NUNCA se desmonta al minimizar la app: solo se
// vuelve invisible (y, si hay bloqueo, el teclado del PIN se muestra encima).
// Así, quien sale un momento a mirar un dato en otra app (WhatsApp, la
// calculadora...) vuelve y encuentra el formulario tal cual lo dejó, en vez
// de tener que cargar todo de nuevo.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("iniciando");

  useEffect(() => {
    let cancelado = false;

    // Primer ingreso: sin acceso se va a la pantalla de login normal (todavía
    // no hay nada cargado que cuidar).
    tieneAcceso().then((autorizado) => {
      if (cancelado) return;
      if (!autorizado) {
        router.replace("/login");
        return;
      }
      setEstado("autorizado");
    });
    registrarRebloqueoAlPausar();

    // Al pasar a segundo plano se oculta el contenido de inmediato (no solo
    // se marca bloqueado para la próxima vez): evita que quede a la vista en
    // el selector de apps de Android mientras la app está pausada.
    const listenerPause = App.addListener("pause", () => {
      bloquear();
      if (!cancelado) setEstado((actual) => (actual === "iniciando" ? actual : "oculto"));
    });
    const listenerResume = App.addListener("resume", () => {
      tieneAcceso().then((autorizado) => {
        if (cancelado) return;
        setEstado((actual) => {
          if (actual === "iniciando") return actual;
          return autorizado ? "autorizado" : "bloqueado";
        });
      });
    });

    return () => {
      cancelado = true;
      listenerPause.then((h) => h.remove());
      listenerResume.then((h) => h.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Con el teclado del PIN encima, el botón atrás sale de la app (ver
  // ManejadorBotonAtras) en vez de navegar por debajo del bloqueo.
  useEffect(() => {
    marcarAppBloqueada(estado === "bloqueado");
  }, [estado]);

  if (estado === "iniciando") return null;

  return (
    <>
      {/* visibility (no display:none ni desmontar): conserva lo escrito en
          los formularios y hasta la posición del scroll. "contents" hace que
          este envoltorio no altere el layout de lo que tiene adentro. */}
      <div className="contents" style={estado === "autorizado" ? undefined : { visibility: "hidden" }}>
        {children}
      </div>
      {estado === "bloqueado" && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--mt-bg-app)" }}>
          <LoginForm onDesbloqueado={() => setEstado("autorizado")} />
        </div>
      )}
    </>
  );
}
