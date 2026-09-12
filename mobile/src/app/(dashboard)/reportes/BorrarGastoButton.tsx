"use client";

import { useTransition } from "react";
import { borrarGasto } from "@/actions/gastos.actions";

export function BorrarGastoButton({ gastoId, onExito }: { gastoId: number; onExito: () => void }) {
  const [enviando, iniciarTransicion] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        iniciarTransicion(async () => {
          await borrarGasto(gastoId);
          onExito();
        })
      }
      disabled={enviando}
      className="text-xs font-medium text-danger-600 hover:underline disabled:opacity-60"
    >
      {enviando ? "Borrando..." : "Borrar"}
    </button>
  );
}
