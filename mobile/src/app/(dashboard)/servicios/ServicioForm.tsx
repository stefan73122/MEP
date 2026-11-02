"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarServicio,
  crearServicio,
  type EstadoFormularioServicio,
} from "@/actions/servicios.actions";
import { centavosATextoEditable } from "@/lib/money";
import type { Servicio } from "@/lib/db/types";

const ESTADO_INICIAL: EstadoFormularioServicio = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

// Alta y edición de un servicio (sin `servicio` = alta).
export function ServicioForm({ servicio, onGuardado }: { servicio?: Servicio; onGuardado?: () => void }) {
  const router = useRouter();
  const [estado, formAction, enviando] = useActionState(servicio ? actualizarServicio : crearServicio, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.id) router.replace("/servicios");
    if (estado.exito) onGuardado?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  return (
    <form action={formAction} className="space-y-4">
      {servicio && <input type="hidden" name="id" value={servicio.id} />}

      <div>
        <label htmlFor="nombre" className={clasesLabel}>
          Nombre del servicio
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          autoFocus={!servicio}
          placeholder="Corte de pelo, cambio de aceite..."
          defaultValue={servicio?.nombre ?? ""}
          className={clasesInput}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col justify-end">
          <label htmlFor="precioTexto" className={clasesLabel}>
            Precio
          </label>
          <input
            id="precioTexto"
            name="precioTexto"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={servicio ? centavosATextoEditable(servicio.precio) : ""}
            className={clasesInput}
          />
        </div>
        <div className="flex flex-col justify-end">
          <label htmlFor="duracionTexto" className={clasesLabel}>
            Duración (min, opcional)
          </label>
          <input
            id="duracionTexto"
            name="duracionTexto"
            type="text"
            inputMode="numeric"
            placeholder="30"
            defaultValue={servicio?.duracionMinutos ?? ""}
            className={clasesInput}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Es el precio sugerido: al registrar una atención lo podés cambiar.
      </p>

      <div>
        <label htmlFor="descripcion" className={clasesLabel}>
          Descripción (opcional)
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={2}
          defaultValue={servicio?.descripcion ?? ""}
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
          Guardado correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : servicio ? "Guardar cambios" : "Guardar servicio"}
      </button>
    </form>
  );
}
