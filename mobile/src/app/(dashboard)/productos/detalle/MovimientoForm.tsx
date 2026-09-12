"use client";

import { useActionState, useEffect, useState } from "react";
import { registrarMovimiento, type EstadoMovimiento } from "@/actions/inventario.actions";

const ESTADO_INICIAL: EstadoMovimiento = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

const TIPOS = [
  { valor: "ENTRADA", etiqueta: "Entrada", ayuda: "Cantidad a ingresar" },
  { valor: "SALIDA", etiqueta: "Salida", ayuda: "Cantidad a retirar" },
  { valor: "AJUSTE", etiqueta: "Ajuste", ayuda: "Cantidad real contada" },
] as const;

type Props = {
  productoId: number;
  unidadMedida: string;
  onExito: () => void;
};

export function MovimientoForm({ productoId, unidadMedida, onExito }: Props) {
  const [estado, formAction, enviando] = useActionState(registrarMovimiento, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["valor"]>("ENTRADA");
  const [formularioId, setFormularioId] = useState(0);

  useEffect(() => {
    if (estado.exito) {
      setFormularioId((id) => id + 1);
      setTipo("ENTRADA");
      onExito();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const ayuda = TIPOS.find((t) => t.valor === tipo)?.ayuda ?? "Cantidad";

  return (
    <form key={formularioId} action={formAction} className="space-y-3">
      <input type="hidden" name="productoId" value={productoId} />

      <div className="grid grid-cols-3 gap-2">
        {TIPOS.map((opcion) => (
          <label
            key={opcion.valor}
            className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium ${
              tipo === opcion.valor
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-slate-300 text-slate-600"
            }`}
          >
            <input
              type="radio"
              name="tipo"
              value={opcion.valor}
              checked={tipo === opcion.valor}
              onChange={() => setTipo(opcion.valor)}
              className="sr-only"
            />
            {opcion.etiqueta}
          </label>
        ))}
      </div>

      <div>
        <label htmlFor="cantidadTexto" className="block text-sm font-medium text-slate-700">
          {ayuda} ({unidadMedida})
        </label>
        <input id="cantidadTexto" name="cantidadTexto" type="text" inputMode="decimal" required className={clasesInput} />
      </div>

      <div>
        <label htmlFor="motivo" className="block text-sm font-medium text-slate-700">
          Motivo
        </label>
        <input
          id="motivo"
          name="motivo"
          type="text"
          placeholder="Ej: compra a proveedor, producto vencido, conteo mensual..."
          required
          className={clasesInput}
        />
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}
      {estado.exito && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-500" role="status">
          Movimiento registrado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {enviando ? "Registrando..." : "Registrar movimiento"}
      </button>
    </form>
  );
}
