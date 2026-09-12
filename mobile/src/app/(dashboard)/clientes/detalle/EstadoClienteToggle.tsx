"use client";

import { useTransition } from "react";
import { cambiarEstadoCliente } from "@/actions/clientes.actions";

export function EstadoClienteToggle({
  clienteId,
  activo,
  onExito,
}: {
  clienteId: number;
  activo: boolean;
  onExito: () => void;
}) {
  const [enviando, iniciarTransicion] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        iniciarTransicion(async () => {
          await cambiarEstadoCliente(clienteId, !activo);
          onExito();
        })
      }
      disabled={enviando}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
        activo ? "text-danger-600 hover:bg-red-50" : "text-success-500 hover:bg-green-50"
      }`}
    >
      {activo ? "Desactivar cliente" : "Reactivar cliente"}
    </button>
  );
}
