"use client";

import { startTransition, useActionState, useEffect, useState, type ChangeEvent } from "react";
import { alRecibirArchivoEntrante, tomarArchivoEntrante } from "@/lib/archivoEntrante";
import {
  confirmarImportacion,
  previsualizarImportacion,
  type EstadoImportacion,
  type EstadoPrevisualizacion,
} from "@/actions/importacion.actions";

const ESTADO_PREVIEW: EstadoPrevisualizacion = {};
const ESTADO_CONFIRM: EstadoImportacion = {};

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportarForm() {
  const [estadoPreview, previewAction, cargandoPreview] = useActionState(previsualizarImportacion, ESTADO_PREVIEW);
  const [estadoConfirm, confirmAction, confirmando] = useActionState(confirmarImportacion, ESTADO_CONFIRM);
  // El formulario se resetea al terminar la acción, así que el archivo elegido se guarda aparte.
  const [archivo, setArchivo] = useState<{ nombre: string; tamano: number } | null>(null);
  const [errorEntrante, setErrorEntrante] = useState<string | null>(null);

  const filas = cargandoPreview ? undefined : estadoPreview.filas;
  const filasValidas = filas?.filter((f) => f.errores.length === 0) ?? [];

  // Excel abierto desde otra app ("Abrir con" en WhatsApp, Archivos...): se
  // toma al entrar a la pantalla y se previsualiza solo.
  useEffect(() => {
    const cargarEntrante = () => {
      tomarArchivoEntrante()
        .then((entrante) => {
          if (!entrante) return;
          setErrorEntrante(null);
          setArchivo({ nombre: entrante.name, tamano: entrante.size });
          const datos = new FormData();
          datos.set("archivo", entrante);
          startTransition(() => previewAction(datos));
        })
        .catch(() => setErrorEntrante("No se pudo abrir el archivo recibido. Probá elegirlo desde acá."));
    };

    cargarEntrante();
    return alRecibirArchivoEntrante(cargarEntrante);
  }, [previewAction]);

  function alElegirArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setErrorEntrante(null);
    setArchivo({ nombre: elegido.name, tamano: elegido.size });
    evento.target.form?.requestSubmit();
  }

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
                  Fila {e.numero} ({e.nombre}): {e.mensaje}
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

  return (
    <div className="space-y-3">
      <form action={previewAction} className="space-y-3 rounded-xl bg-white p-4">
        <p className="text-sm font-medium text-slate-700">2. Elegí tu archivo Excel (.xlsx)</p>

        {archivo && (
          <div className="flex items-center gap-2 rounded-lg border border-success-500 bg-green-50 px-3 py-2 text-sm">
            <span aria-hidden="true">📄</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{archivo.nombre}</p>
              <p className="text-xs text-slate-600">
                {cargandoPreview ? "Leyendo archivo..." : `Archivo seleccionado · ${tamanoLegible(archivo.tamano)}`}
              </p>
            </div>
          </div>
        )}

        <label
          htmlFor="archivo"
          className={`block w-full cursor-pointer rounded-lg px-4 py-2.5 text-center font-medium transition ${
            archivo
              ? "border border-slate-300 text-slate-700 hover:bg-slate-100"
              : "bg-primary-600 text-white hover:brightness-110"
          } ${cargandoPreview ? "pointer-events-none opacity-60" : ""}`}
        >
          {archivo ? "Elegir otro archivo" : "Seleccionar archivo Excel"}
        </label>
        <input
          id="archivo"
          name="archivo"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={alElegirArchivo}
          className="sr-only"
        />

        {!cargandoPreview && (errorEntrante ?? estadoPreview.error) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
            {errorEntrante ?? estadoPreview.error}
          </p>
        )}
      </form>

      {filas && (
        <>
          <div className="rounded-xl bg-white p-4">
            <p className="text-sm font-medium text-slate-700">3. Revisá los productos</p>
            <p className="text-sm text-slate-600">
              {filasValidas.length} de {filas.length} filas están listas para subir.
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
                </p>
                <p className="text-xs text-slate-600">
                  {fila.categoria ?? "Sin categoría"} · {fila.unidadMedida} · Compra {fila.precioCompraTexto || "—"} ·
                  Venta {fila.precioVentaTexto || "—"}
                </p>
                <p className="text-xs text-slate-600">
                  Stock {fila.perecedero ? (fila.cantidadLoteTexto ?? "0") : fila.stockInicialTexto} · Mínimo{" "}
                  {fila.stockMinimoTexto}
                  {fila.perecedero && fila.fechaVencimientoTexto ? ` · Vence ${fila.fechaVencimientoTexto}` : ""}
                </p>
                {fila.errores.length > 0 ? (
                  <ul className="list-disc pl-4 text-xs text-danger-600">
                    {fila.errores.map((error, indice) => (
                      <li key={indice}>{error}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-success-500">Lista para subir</p>
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
              {confirmando ? "Subiendo..." : `Subir productos (${filasValidas.length})`}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
