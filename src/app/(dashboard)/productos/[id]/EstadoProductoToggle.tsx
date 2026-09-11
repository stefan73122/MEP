"use client";

import { useTransition } from "react";
import { cambiarEstadoProducto } from "@/actions/productos.actions";

export function EstadoProductoToggle({
  productoId,
  activo,
}: {
  productoId: number;
  activo: boolean;
}) {
  const [enviando, iniciarTransicion] = useTransition();

  return (
    <button
      type="button"
      onClick={() => iniciarTransicion(() => cambiarEstadoProducto(productoId, !activo))}
      disabled={enviando}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
        activo
          ? "text-danger-600 hover:bg-red-50"
          : "text-success-500 hover:bg-green-50"
      }`}
    >
      {activo ? "Desactivar producto" : "Reactivar producto"}
    </button>
  );
}
