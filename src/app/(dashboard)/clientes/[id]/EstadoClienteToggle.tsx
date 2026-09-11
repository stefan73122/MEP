"use client";

import { useTransition } from "react";
import { cambiarEstadoCliente } from "@/actions/clientes.actions";

export function EstadoClienteToggle({
  clienteId,
  activo,
}: {
  clienteId: number;
  activo: boolean;
}) {
  const [enviando, iniciarTransicion] = useTransition();

  return (
    <button
      type="button"
      onClick={() => iniciarTransicion(() => cambiarEstadoCliente(clienteId, !activo))}
      disabled={enviando}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
        activo ? "text-danger-600 hover:bg-red-50" : "text-success-500 hover:bg-green-50"
      }`}
    >
      {activo ? "Desactivar cliente" : "Reactivar cliente"}
    </button>
  );
}
