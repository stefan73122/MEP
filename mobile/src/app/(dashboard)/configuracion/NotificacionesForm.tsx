"use client";

import { useEffect, useState } from "react";
import {
  guardarConfigNotificaciones,
  leerConfigNotificaciones,
  probarNotificacion,
  type ConfigNotificaciones,
  type ResultadoNotificaciones,
  type UnidadRepeticion,
} from "@/lib/notificaciones";

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

const UNIDADES: { valor: UnidadRepeticion; etiqueta: string }[] = [
  { valor: "minuto", etiqueta: "Minutos" },
  { valor: "hora", etiqueta: "Horas" },
  { valor: "dia", etiqueta: "Cada día" },
];

export function NotificacionesForm() {
  const [config, setConfig] = useState<ConfigNotificaciones | null>(null);
  const [cadaTexto, setCadaTexto] = useState("1");
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  useEffect(() => {
    leerConfigNotificaciones().then((c) => {
      setConfig(c);
      setCadaTexto(String(c.cada));
    });
  }, []);

  if (config === null) return null;

  function cambiar(cambios: Partial<ConfigNotificaciones>) {
    setMensaje(null);
    setConfig((c) => (c ? { ...c, ...cambios } : c));
  }

  async function ejecutar(accion: () => Promise<ResultadoNotificaciones>, textoExito: string) {
    setOcupado(true);
    setMensaje(null);
    try {
      const resultado = await accion();
      setMensaje(resultado.ok ? { tipo: "exito", texto: textoExito } : { tipo: "error", texto: resultado.error });
    } catch {
      setMensaje({ tipo: "error", texto: "No se pudo completar. Intentá de nuevo." });
    } finally {
      setOcupado(false);
    }
  }

  function guardar() {
    if (!config) return;
    const cada = Number(cadaTexto);
    if (config.unidad !== "dia" && (!Number.isInteger(cada) || cada < 1)) {
      setMensaje({ tipo: "error", texto: "Indicá cada cuánto se repite con un número entero mayor a 0." });
      return;
    }
    const nueva = config.unidad === "dia" ? config : { ...config, cada };
    ejecutar(() => guardarConfigNotificaciones(nueva), "Guardado correctamente.");
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Te avisa cuando hay productos con stock bajo, vencidos o por vencer. Si no hay ninguna alerta, no se muestra
        nada.
      </p>

      <label className="flex items-center justify-between gap-3">
        <span className={clasesLabel}>Activar notificaciones</span>
        <input
          type="checkbox"
          checked={config.activadas}
          onChange={(e) => cambiar({ activadas: e.target.checked })}
          className="h-5 w-5 accent-primary-600"
        />
      </label>

      {config.activadas && (
        <>
          <div>
            <span className={clasesLabel}>Repetir cada</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {UNIDADES.map((unidad) => (
                <label
                  key={unidad.valor}
                  className={`flex min-w-0 -skew-x-[7deg] cursor-pointer items-center justify-center rounded-lg border px-1 py-2.5 text-center text-sm font-medium ${
                    config.unidad === unidad.valor
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-slate-300 text-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="unidadNotificacion"
                    value={unidad.valor}
                    checked={config.unidad === unidad.valor}
                    onChange={() => cambiar({ unidad: unidad.valor })}
                    className="sr-only"
                  />
                  <span className="skew-x-[7deg] leading-tight">{unidad.etiqueta}</span>
                </label>
              ))}
            </div>
          </div>

          {config.unidad === "dia" ? (
            <div>
              <label htmlFor="horaNotificacion" className={clasesLabel}>
                Hora del aviso
              </label>
              <input
                id="horaNotificacion"
                type="time"
                value={config.hora}
                onChange={(e) => cambiar({ hora: e.target.value || "08:00" })}
                className={clasesInput}
              />
            </div>
          ) : (
            <div>
              <label htmlFor="cadaNotificacion" className={clasesLabel}>
                {config.unidad === "minuto" ? "Cada cuántos minutos" : "Cada cuántas horas"}
              </label>
              <input
                id="cadaNotificacion"
                type="text"
                inputMode="numeric"
                value={cadaTexto}
                onChange={(e) => {
                  setMensaje(null);
                  setCadaTexto(e.target.value);
                }}
                className={clasesInput}
              />
            </div>
          )}
        </>
      )}

      {mensaje && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === "exito" ? "bg-green-50 text-success-500" : "bg-red-50 text-danger-600"
          }`}
          role={mensaje.tipo === "exito" ? "status" : "alert"}
        >
          {mensaje.texto}
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={ocupado}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        Guardar notificaciones
      </button>
      <button
        type="button"
        onClick={() => ejecutar(probarNotificacion, "Listo: la notificación de prueba llega en unos segundos.")}
        disabled={ocupado}
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        Enviar notificación de prueba
      </button>
    </div>
  );
}
