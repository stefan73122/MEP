"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { crearProducto, type EstadoFormularioProducto } from "@/actions/productos.actions";
import type { TipoVenta } from "@/lib/constants";

const ESTADO_INICIAL: EstadoFormularioProducto = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

export function NuevoProductoForm() {
  const router = useRouter();
  const [estado, formAction, enviando] = useActionState(crearProducto, ESTADO_INICIAL);
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>("UNIDAD");
  const [perecedero, setPerecedero] = useState(false);

  useEffect(() => {
    if (estado.id) router.replace("/productos");
  }, [estado, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="sku" className={clasesLabel}>
            Código / SKU
          </label>
          <input id="sku" name="sku" type="text" required autoFocus className={clasesInput} />
        </div>
        <div>
          <label htmlFor="categoria" className={clasesLabel}>
            Categoría
          </label>
          <input id="categoria" name="categoria" type="text" className={clasesInput} />
        </div>
      </div>

      <div>
        <label htmlFor="nombre" className={clasesLabel}>
          Nombre del producto
        </label>
        <input id="nombre" name="nombre" type="text" required className={clasesInput} />
      </div>

      <fieldset>
        <legend className={clasesLabel}>¿Cómo se vende?</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(
            [
              { valor: "UNIDAD", etiqueta: "Por unidad" },
              { valor: "PESO", etiqueta: "Por peso (kg)" },
              { valor: "VOLUMEN", etiqueta: "Por volumen (litro)" },
            ] as const
          ).map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium ${
                tipoVenta === opcion.valor
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="tipoVenta"
                value={opcion.valor}
                checked={tipoVenta === opcion.valor}
                onChange={() => setTipoVenta(opcion.valor)}
                className="sr-only"
              />
              {opcion.etiqueta}
            </label>
          ))}
        </div>
        {tipoVenta === "UNIDAD" ? (
          <div className="mt-2">
            <label htmlFor="unidadMedidaPersonalizada" className={clasesLabel}>
              ¿Cómo se llama la unidad? (opcional)
            </label>
            <input
              id="unidadMedidaPersonalizada"
              name="unidadMedidaPersonalizada"
              type="text"
              placeholder="unidad, paquete, caja, docena..."
              className={clasesInput}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Vas a poder vender fracciones, por ejemplo 0.5 {tipoVenta === "PESO" ? "kg" : "litro"}.
          </p>
        )}
      </fieldset>

      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5">
        <input
          type="checkbox"
          name="perecedero"
          checked={perecedero}
          onChange={(e) => setPerecedero(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-slate-700">
          Es perecedero (tiene fecha de vencimiento, se maneja por lotes)
        </span>
      </label>

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
            placeholder="0.00"
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
            placeholder="0.00"
            required
            className={clasesInput}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="stockInicialTexto" className={clasesLabel}>
            {perecedero ? "Cantidad del primer lote" : "Stock inicial"}
          </label>
          <input
            id="stockInicialTexto"
            name="stockInicialTexto"
            type="text"
            inputMode="decimal"
            placeholder="0"
            className={clasesInput}
          />
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
            placeholder="0"
            required
            className={clasesInput}
          />
        </div>
      </div>

      {perecedero && (
        <div>
          <label htmlFor="fechaVencimientoInicialTexto" className={clasesLabel}>
            Vencimiento del primer lote
          </label>
          <input
            id="fechaVencimientoInicialTexto"
            name="fechaVencimientoInicialTexto"
            type="text"
            placeholder="dd/mm/aaaa"
            className={clasesInput}
          />
          <p className="mt-1 text-xs text-slate-500">
            Hace falta solo si cargás una cantidad en &quot;Cantidad del primer lote&quot;. Después vas a
            poder agregar más lotes desde la ficha del producto.
          </p>
        </div>
      )}

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Guardar producto"}
      </button>
    </form>
  );
}
