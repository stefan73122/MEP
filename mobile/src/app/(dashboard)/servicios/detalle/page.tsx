"use client";

import { Suspense, useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { cambiarEstadoServicio } from "@/actions/servicios.actions";
import type { Servicio } from "@/lib/db/types";
import { ServicioForm } from "../ServicioForm";

function ServicioDetalleContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));

  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [recargarClave, setRecargarClave] = useState(0);
  const [cambiandoEstado, iniciarCambioEstado] = useTransition();

  const recargar = useCallback(() => setRecargarClave((c) => c + 1), []);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      router.replace("/servicios");
      return;
    }
    let cancelado = false;
    db.servicio.findUnique(id).then((s) => {
      if (cancelado) return;
      if (!s) {
        router.replace("/servicios");
        return;
      }
      setServicio(s);
    });
    return () => {
      cancelado = true;
    };
  }, [id, recargarClave, router]);

  if (!servicio) return <p className="text-sm text-slate-500">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/servicios" className="text-sm text-slate-500 hover:underline">
        ← Servicios
      </Link>

      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 truncate text-lg font-semibold text-slate-900">{servicio.nombre}</h1>
        {!servicio.activo && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
            Inactivo
          </span>
        )}
      </div>

      <div className="rounded-xl bg-white p-4">
        <ServicioForm servicio={servicio} onGuardado={recargar} />
      </div>

      <div className="rounded-xl bg-white p-4">
        <p className="mb-2 text-xs text-slate-500">
          {servicio.activo
            ? "Si ya no lo ofrecés, desactivalo: deja de aparecer al atender, pero las atenciones pasadas lo siguen mostrando."
            : "Está desactivado: no aparece al registrar una atención."}
        </p>
        <button
          type="button"
          disabled={cambiandoEstado}
          onClick={() =>
            iniciarCambioEstado(async () => {
              await cambiarEstadoServicio(servicio.id, !servicio.activo);
              recargar();
            })
          }
          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
            servicio.activo ? "text-danger-600 hover:bg-red-50" : "text-success-500 hover:bg-green-50"
          }`}
        >
          {servicio.activo ? "Desactivar servicio" : "Reactivar servicio"}
        </button>
      </div>
    </div>
  );
}

export default function ServicioDetallePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <ServicioDetalleContenido />
    </Suspense>
  );
}
