"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { generarPlantillaExcel } from "@/lib/excelProductos";
import { guardarBinario } from "@/lib/archivos";
import { ImportarForm } from "./ImportarForm";

export default function ImportarProductosPage() {
  const [descargando, iniciarDescarga] = useTransition();
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  function descargarPlantilla() {
    setErrorDescarga(null);
    iniciarDescarga(async () => {
      try {
        const buffer = await generarPlantillaExcel();
        await guardarBinario(
          "plantilla-productos.xlsx",
          buffer,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      } catch {
        setErrorDescarga("No se pudo generar la plantilla. Intentá de nuevo.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/productos" className="text-sm text-slate-500 hover:underline">
        ← Productos
      </Link>
      <h1 className="text-lg font-semibold text-slate-900">Importar productos desde Excel</h1>

      <div className="rounded-xl bg-white p-4 text-sm text-slate-600">
        <p className="mb-2">
          1. Descargá la plantilla, completala con tus productos y subila de vuelta. Vas a poder revisar
          todo antes de que se guarde nada.
        </p>
        <button
          type="button"
          onClick={descargarPlantilla}
          disabled={descargando}
          className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          {descargando ? "Generando..." : "Descargar plantilla"}
        </button>
        {errorDescarga && <p className="mt-2 text-xs text-danger-600">{errorDescarga}</p>}
      </div>

      <ImportarForm />
    </div>
  );
}
