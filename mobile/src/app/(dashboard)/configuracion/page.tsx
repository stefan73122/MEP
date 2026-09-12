"use client";

import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db/client";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import type { Configuracion } from "@/lib/db/types";
import { ConfiguracionForm } from "./ConfiguracionForm";
import { PinForm } from "./PinForm";

export default function ConfiguracionPage() {
  const [cargando, setCargando] = useState(true);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [recargarClave, setRecargarClave] = useState(0);

  const recargar = useCallback(() => setRecargarClave((c) => c + 1), []);

  useEffect(() => {
    let cancelado = false;
    db.configuracion.findFirst().then((c) => {
      if (cancelado) return;
      setConfiguracion(c);
      setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [recargarClave]);

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Configuración</h1>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Negocio</h2>
        <ConfiguracionForm
          nombreNegocio={configuracion?.nombreNegocio ?? "Mi Tienda"}
          moneda={configuracion?.moneda ?? "BOB"}
          simboloMoneda={configuracion?.simboloMoneda ?? "Bs"}
          diasAlertaVencimiento={configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO}
          onExito={recargar}
        />
      </div>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">PIN de acceso</h2>
        <PinForm pinConfigurado={!!configuracion?.pinHash} onCambio={recargar} />
      </div>
    </div>
  );
}
