"use client";

import { useActionState } from "react";
import { registrarPago, type EstadoPago } from "@/actions/clientes.actions";

const ESTADO_INICIAL: EstadoPago = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export function PagoForm({ clienteId }: { clienteId: number }) {
  const [estado, formAction, enviando] = useActionState(registrarPago, ESTADO_INICIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="clienteId" value={clienteId} />

      <div>
        <label htmlFor="montoTexto" className="block text-sm font-medium text-slate-700">
          Monto pagado
        </label>
        <input
          id="montoTexto"
          name="montoTexto"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          required
          className={clasesInput}
        />
      </div>

      <div>
        <label htmlFor="observacion" className="block text-sm font-medium text-slate-700">
          Observación (opcional)
        </label>
        <input id="observacion" name="observacion" type="text" className={clasesInput} />
      </div>

      <p className="text-xs text-slate-500">
        El pago se aplica primero a la deuda más antigua del cliente.
      </p>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}
      {estado.exito && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success-500" role="status">
          Pago registrado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {enviando ? "Registrando..." : "Registrar pago"}
      </button>
    </form>
  );
}
