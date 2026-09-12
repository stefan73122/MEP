"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { centavosATexto } from "@/lib/money";
import { unidadesMinimasATexto } from "@/lib/stock";
import { fechaHoraATexto } from "@/lib/dates";
import type { VentaDetalle } from "@/lib/db/types";
import { AnularVentaForm } from "./AnularVentaForm";

const ETIQUETAS_FORMA_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA_QR: "Transferencia/QR",
  CREDITO: "Crédito",
};

function VentaDetalleContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));

  const [cargando, setCargando] = useState(true);
  const [venta, setVenta] = useState<VentaDetalle | null>(null);
  const [simbolo, setSimbolo] = useState("Bs");
  const [recargarClave, setRecargarClave] = useState(0);

  const recargar = useCallback(() => setRecargarClave((c) => c + 1), []);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      router.replace("/ventas");
      return;
    }
    let cancelado = false;
    async function cargar() {
      const [v, configuracion] = await Promise.all([db.venta.findDetalle(id), db.configuracion.findFirst()]);
      if (!v) {
        router.replace("/ventas");
        return;
      }
      if (cancelado) return;
      setVenta(v);
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [id, recargarClave, router]);

  if (cargando || !venta) return <p className="text-sm text-slate-500">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/ventas" className="text-sm text-slate-500 hover:underline">
        ← Ventas
      </Link>

      <div className="rounded-xl bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Venta #{venta.id}</h1>
            <p className="text-xs text-slate-500">{fechaHoraATexto(venta.fecha)}</p>
          </div>
          {venta.estado === "ANULADA" && (
            <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-danger-600">
              Anulada
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <p>Cliente: {venta.cliente?.nombre ?? "Cliente ocasional"}</p>
          <p>Forma de pago: {ETIQUETAS_FORMA_PAGO[venta.formaPago] ?? venta.formaPago}</p>
        </div>

        {venta.estado === "ANULADA" && venta.motivoAnulacion && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-danger-600">
            Motivo de anulación: {venta.motivoAnulacion}
          </p>
        )}
      </div>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Productos</h2>
        <ul className="space-y-2">
          {venta.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{item.producto.nombre}</p>
                <p className="text-xs text-slate-500">
                  {unidadesMinimasATexto(item.cantidad, item.producto.factorConversion)} {item.producto.unidadMedida} ×{" "}
                  {centavosATexto(item.precioUnitario, simbolo)}
                  {item.descuento > 0 && ` · desc. ${centavosATexto(item.descuento, simbolo)}`}
                </p>
              </div>
              <p className="shrink-0 font-medium text-slate-900">{centavosATexto(item.subtotal, simbolo)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{centavosATexto(venta.subtotal, simbolo)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Descuento</span>
            <span>{centavosATexto(venta.descuento, simbolo)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{centavosATexto(venta.total, simbolo)}</span>
          </div>
        </div>
      </div>

      {venta.estado === "COMPLETADA" && (
        <div className="rounded-xl bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Anular venta</h2>
          <AnularVentaForm ventaId={venta.id} onExito={recargar} />
        </div>
      )}
    </div>
  );
}

export default function VentaDetallePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <VentaDetalleContenido />
    </Suspense>
  );
}
