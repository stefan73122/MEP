"use client";

import { useTransition } from "react";
import { borrarGasto } from "@/actions/gastos.actions";

export function BorrarGastoButton({ gastoId }: { gastoId: number }) {
  const [enviando, iniciarTransicion] = useTransition();

  return (
    <button
      type="button"
      onClick={() => iniciarTransicion(() => borrarGasto(gastoId))}
      disabled={enviando}
      className="text-xs font-medium text-danger-600 hover:underline disabled:opacity-60"
    >
      {enviando ? "Borrando..." : "Borrar"}
    </button>
  );
}
