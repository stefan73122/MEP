"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { obtenerResumenTablero, type ResumenTablero } from "@/lib/tablero";
import { centavosATexto } from "@/lib/money";
import { IconAlertaTriangulo, IconReloj, IconVentas } from "@/components/ui/icons";
import { useIrAPrincipal } from "@/components/pager/useIrAPrincipal";

export default function TableroPage() {
  const irA = useIrAPrincipal();
  const [cargando, setCargando] = useState(true);
  const [simbolo, setSimbolo] = useState("Bs");
  const [resumen, setResumen] = useState<ResumenTablero | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [configuracion, resumenTablero] = await Promise.all([
        db.configuracion.findFirst(),
        obtenerResumenTablero(db),
      ]);
      if (cancelado) return;
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setResumen(resumenTablero);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (cargando || !resumen) return <p className="text-sm text-slate-500">Cargando...</p>;

  const sinVentasHoy = resumen.cantidadVentasHoy === 0;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Inicio</h1>

      {/* Total vendido hoy: dato principal */}
      <div className="rounded-xl bg-white p-5 text-center">
        <p className="text-xs font-medium text-slate-500">Vendido hoy</p>
        <p className="mt-1 text-4xl font-semibold text-slate-900">{centavosATexto(resumen.totalHoy, simbolo)}</p>
      </div>

      {/* Desglose por forma de pago */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Efectivo</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{centavosATexto(resumen.efectivoHoy, simbolo)}</p>
        </div>
        <div className="rounded-xl bg-white p-4">
          <p className="text-xs font-medium text-slate-500">A crédito</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{centavosATexto(resumen.creditoHoy, simbolo)}</p>
        </div>
      </div>

      {/* Cantidad de ventas del día */}
      <Link
        href="/ventas"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-300"
      >
        <IconVentas className="text-primary-500" />
        <span className="flex-1 text-sm font-medium text-slate-600">Ventas de hoy</span>
        <span className="text-lg font-semibold text-slate-900">{resumen.cantidadVentasHoy}</span>
      </Link>

      {sinVentasHoy && (
        <Link
          href="/ventas/nueva"
          className="flex h-14 items-center justify-center rounded-full bg-primary-600 px-4 text-base font-medium text-white hover:brightness-110"
        >
          Registrar una venta
        </Link>
      )}

      {/* Fiado pendiente de cobro (todos los clientes) */}
      <button
        type="button"
        onClick={() => irA("/clientes", { cxc: true })}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-primary-300"
      >
        <span className="text-sm font-medium text-slate-600">Fiado pendiente de cobro</span>
        <span className="text-lg font-semibold text-danger-600">
          {centavosATexto(resumen.fiadoPendienteTotal, simbolo)}
        </span>
      </button>

      {/* Alertas: productos por vencer y stock bajo */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => irA("/productos", { vencimiento: "porVencer" })}
          className={`flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-left ${
            resumen.productosPorVencer > 0 ? "bg-orange-50 text-warning-500" : "bg-white text-slate-500"
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <IconReloj /> Productos por vencer
          </span>
          <span className="text-lg font-semibold">{resumen.productosPorVencer}</span>
        </button>
        <button
          type="button"
          onClick={() => irA("/productos", { bajo: true })}
          className={`flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-left ${
            resumen.productosStockBajo > 0 ? "bg-red-50 text-danger-600" : "bg-white text-slate-500"
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <IconAlertaTriangulo /> Stock bajo
          </span>
          <span className="text-lg font-semibold">{resumen.productosStockBajo}</span>
        </button>
      </div>
    </div>
  );
}
