"use client";

import { useActionState } from "react";
import {
  confirmarImportacion,
  previsualizarImportacion,
  type EstadoImportacion,
  type EstadoPrevisualizacion,
} from "@/actions/importacion.actions";

const ESTADO_PREVIEW: EstadoPrevisualizacion = {};
const ESTADO_CONFIRM: EstadoImportacion = {};

export function ImportarForm() {
  const [estadoPreview, previewAction, cargandoPreview] = useActionState(previsualizarImportacion, ESTADO_PREVIEW);
  const [estadoConfirm, confirmAction, confirmando] = useActionState(confirmarImportacion, ESTADO_CONFIRM);

  const filas = estadoPreview.filas;
  const filasValidas = filas?.filter((f) => f.errores.length === 0) ?? [];

  if (estadoConfirm.resultado) {
    const { importados, errores } = estadoConfirm.resultado;
    return (
      <div className="space-y-2 rounded-xl bg-white p-4 text-sm">
        <p className="font-medium text-slate-900">
          Se importaron {importados} producto{importados === 1 ? "" : "s"}.
        </p>
        {errores.length > 0 && (
          <div>
            <p className="font-medium text-danger-600">No se pudieron importar {errores.length}:</p>
            <ul className="list-disc pl-5 text-xs text-slate-600">
              {errores.map((e) => (
                <li key={e.numero}>
                  Fila {e.numero} ({e.sku}): {e.mensaje}
                </li>
              ))}
            </ul>
          </div>
        )}
        <a href="/productos" className="inline-block text-sm font-medium text-primary-700 hover:underline">
          Ir a productos →
        </a>
      </div>
    );
  }

  if (!filas) {
    return (
      <form action={previewAction} className="space-y-3 rounded-xl bg-white p-4">
        <div>
          <label htmlFor="archivo" className="block text-sm font-medium text-slate-700">
            Archivo Excel (.xlsx)
          </label>
          <input id="archivo" name="archivo" type="file" accept=".xlsx" required className="mt-1 w-full text-sm" />
        </div>

        {estadoPreview.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {estadoPreview.error}
          </p>
        )}

        <button
          type="submit"
          disabled={cargandoPreview}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {cargandoPreview ? "Leyendo..." : "Ver vista previa"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-4">
        <p className="text-sm text-slate-600">
          {filasValidas.length} de {filas.length} filas están listas para importar.
        </p>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto">
        {filas.map((fila) => (
          <div
            key={fila.numero}
            className={`rounded-lg border p-2 text-sm ${
              fila.errores.length > 0 ? "border-danger-600 bg-red-50" : "border-slate-200 bg-white"
            }`}
          >
            <p className="font-medium text-slate-900">
              Fila {fila.numero}: {fila.nombre || "(sin nombre)"}
              {fila.sku ? ` (${fila.sku})` : ""}
            </p>
            {fila.errores.length > 0 ? (
              <ul className="list-disc pl-4 text-xs text-danger-600">
                {fila.errores.map((error, indice) => (
                  <li key={indice}>{error}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-success-500">Lista para importar</p>
            )}
          </div>
        ))}
      </div>

      <form action={confirmAction} className="rounded-xl bg-white p-4">
        <input type="hidden" name="filasJson" value={JSON.stringify(filasValidas)} />

        {estadoConfirm.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {estadoConfirm.error}
          </p>
        )}

        <button
          type="submit"
          disabled={confirmando || filasValidas.length === 0}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {confirmando ? "Importando..." : `Confirmar importación (${filasValidas.length})`}
        </button>
      </form>
    </div>
  );
}
