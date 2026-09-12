"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { crearCliente, type EstadoFormularioCliente } from "@/actions/clientes.actions";

const ESTADO_INICIAL: EstadoFormularioCliente = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

export function NuevoClienteForm() {
  const router = useRouter();
  const [estado, formAction, enviando] = useActionState(crearCliente, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.id) router.replace(`/clientes/detalle?id=${estado.id}`);
  }, [estado, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="nombre" className={clasesLabel}>
          Nombre
        </label>
        <input id="nombre" name="nombre" type="text" required autoFocus className={clasesInput} />
      </div>

      <div>
        <label htmlFor="telefono" className={clasesLabel}>
          Teléfono (opcional)
        </label>
        <input id="telefono" name="telefono" type="text" className={clasesInput} />
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
          placeholder="0.00"
          required
          className={clasesInput}
        />
        <p className="mt-1 text-xs text-slate-500">Poné 0 si este cliente no va a comprar a crédito.</p>
      </div>

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
        {enviando ? "Guardando..." : "Guardar cliente"}
      </button>
    </form>
  );
}
