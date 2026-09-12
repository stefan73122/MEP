"use client";

import { useActionState, useEffect } from "react";
import { actualizarProducto, type EstadoFormularioProducto } from "@/actions/productos.actions";

const ESTADO_INICIAL: EstadoFormularioProducto = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

type Props = {
  productoId: number;
  nombre: string;
  categoria: string | null;
  precioCompraTexto: string;
  precioVentaTexto: string;
  stockMinimoTexto: string;
  onExito: () => void;
};

export function EditarProductoForm({
  productoId,
  nombre,
  categoria,
  precioCompraTexto,
  precioVentaTexto,
  stockMinimoTexto,
  onExito,
}: Props) {
  const [estado, formAction, enviando] = useActionState(actualizarProducto, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.id) onExito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={productoId} />

      <div>
        <label htmlFor="nombre" className={clasesLabel}>
          Nombre del producto
        </label>
        <input id="nombre" name="nombre" type="text" defaultValue={nombre} required className={clasesInput} />
      </div>

      <div>
        <label htmlFor="categoria" className={clasesLabel}>
          Categoría
        </label>
        <input id="categoria" name="categoria" type="text" defaultValue={categoria ?? ""} className={clasesInput} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="precioCompraTexto" className={clasesLabel}>
            Precio de compra
          </label>
          <input
            id="precioCompraTexto"
            name="precioCompraTexto"
            type="text"
            inputMode="decimal"
            defaultValue={precioCompraTexto}
            required
            className={clasesInput}
          />
        </div>
        <div>
          <label htmlFor="precioVentaTexto" className={clasesLabel}>
            Precio de venta
          </label>
          <input
            id="precioVentaTexto"
            name="precioVentaTexto"
            type="text"
            inputMode="decimal"
            defaultValue={precioVentaTexto}
            required
            className={clasesInput}
          />
        </div>
      </div>

      <div>
        <label htmlFor="stockMinimoTexto" className={clasesLabel}>
          Stock mínimo
        </label>
        <input
          id="stockMinimoTexto"
          name="stockMinimoTexto"
          type="text"
          inputMode="decimal"
          defaultValue={stockMinimoTexto}
          required
          className={clasesInput}
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}
      {estado.id && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-500" role="status">
          Guardado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
