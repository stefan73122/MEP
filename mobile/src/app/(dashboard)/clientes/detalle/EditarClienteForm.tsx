"use client";

import { useActionState, useEffect } from "react";
import { actualizarCliente, type EstadoFormularioCliente } from "@/actions/clientes.actions";

const ESTADO_INICIAL: EstadoFormularioCliente = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

type Props = {
  clienteId: number;
  nombre: string;
  telefono: string | null;
  limiteCreditoTexto: string;
  onExito: () => void;
};

export function EditarClienteForm({ clienteId, nombre, telefono, limiteCreditoTexto, onExito }: Props) {
  const [estado, formAction, enviando] = useActionState(actualizarCliente, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.id) onExito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={clienteId} />

      <div>
        <label htmlFor="nombre" className={clasesLabel}>
          Nombre
        </label>
        <input id="nombre" name="nombre" type="text" defaultValue={nombre} required className={clasesInput} />
      </div>

      <div>
        <label htmlFor="telefono" className={clasesLabel}>
          Teléfono
        </label>
        <input id="telefono" name="telefono" type="text" defaultValue={telefono ?? ""} className={clasesInput} />
      </div>

      <div>
        <label htmlFor="limiteCreditoTexto" className={clasesLabel}>
          Límite de crédito
        </label>
        <input
          id="limiteCreditoTexto"
          name="limiteCreditoTexto"
          type="text"
          inputMode="decimal"
          defaultValue={limiteCreditoTexto}
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
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
