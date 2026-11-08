"use client";

import { useState } from "react";
import { fechaATexto, fechaHoraATexto } from "@/lib/dates";
import { useLicencia } from "@/lib/licenciaContexto";

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{etiqueta}</span>
      <span className="min-w-0 break-all text-right font-medium text-slate-900">{valor}</span>
    </div>
  );
}

export function LicenciaInfo() {
  const licencia = useLicencia();
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  if (!licencia) return null;
  const { datos, codigoDispositivo, cerrarSesion } = licencia;

  function copiarCodigo() {
    navigator.clipboard?.writeText(codigoDispositivo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  async function confirmarCierre() {
    setCerrando(true);
    // Si sale bien, LicenciaGate cambia a la pantalla de inicio de sesión y
    // esta pantalla desaparece.
    await cerrarSesion();
    setCerrando(false);
    setConfirmando(false);
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Estado</span>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-success-500">Activa</span>
        </div>
        {datos.email && <Fila etiqueta="Cuenta" valor={datos.email} />}
        <Fila
          etiqueta="Vence"
          valor={datos.vlic ? fechaATexto(new Date(datos.vlic * 1000)) : "Sin vencimiento"}
        />
        <Fila etiqueta="Última validación" valor={fechaHoraATexto(new Date(datos.iat * 1000))} />
        <Fila etiqueta="Funciona sin conexión hasta" valor={fechaATexto(new Date(datos.exp * 1000))} />
        <p className="text-xs text-slate-500">
          Cada vez que hay internet la licencia se renueva sola y esta fecha se corre.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-slate-500">Código de dispositivo</p>
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm font-semibold text-slate-900">
            {codigoDispositivo}
          </p>
          <button
            type="button"
            onClick={copiarCodigo}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {copiado ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        {confirmando ? (
          <div className="space-y-3">
            <p className="text-slate-600">
              ¿Cerrar sesión en este teléfono? Tus datos se quedan guardados acá. Para volver a entrar vas a necesitar tu
              correo, tu contraseña e internet.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmarCierre}
                disabled={cerrando}
                className="flex-1 rounded-lg bg-danger-500 px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {cerrando ? "Cerrando sesión..." : "Sí, cerrar sesión"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={cerrando}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}
