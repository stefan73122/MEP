"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { centavosATexto } from "@/lib/money";
import { fechaATexto, fechaHoraATexto } from "@/lib/dates";
import { unidadesMinimasATexto } from "@/lib/stock";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import { obtenerLotesPorVencer, obtenerLotesVencidos } from "@/lib/lotes";
import {
  agruparVentasPorDia,
  agruparVentasPorMes,
  calcularGananciaEstimada,
  obtenerGastos,
  obtenerProductosMasVendidos,
  obtenerResumenHoy,
  obtenerVentasCompletadas,
  resolverRangoReporte,
  type GananciaEstimada,
  type GrupoVentas,
  type ProductoMasVendido,
  type ResumenHoy,
} from "@/lib/reportes";
import { filasACsv } from "@/lib/csv";
import { guardarTexto } from "@/lib/archivos";
import type { Gasto, Venta } from "@/lib/db/types";
import { GastoForm } from "./GastoForm";
import { BorrarGastoButton } from "./BorrarGastoButton";

function construirQuery(params: Record<string, string | undefined>): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor) busqueda.set(clave, valor);
  }
  return busqueda.toString();
}

function ReportesContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const desdeTexto = searchParams.get("desde") ?? undefined;
  const hastaTexto = searchParams.get("hasta") ?? undefined;
  const agrupar = searchParams.get("agrupar") ?? undefined;
  const agruparPorMes = agrupar === "mes";

  const [cargando, setCargando] = useState(true);
  const [simbolo, setSimbolo] = useState("Bs");
  const [resumenHoy, setResumenHoy] = useState<ResumenHoy | null>(null);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productosMasVendidos, setProductosMasVendidos] = useState<ProductoMasVendido[]>([]);
  const [ganancia, setGanancia] = useState<GananciaEstimada>({ ingresos: 0, costoEstimado: 0, ganancia: 0 });
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [productosVencidos, setProductosVencidos] = useState(0);
  const [productosPorVencer, setProductosPorVencer] = useState(0);
  const [rango, setRango] = useState<{ desde: Date; hasta: Date } | null>(null);
  const [recargarClave, setRecargarClave] = useState(0);

  const recargar = useCallback(() => setRecargarClave((c) => c + 1), []);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const { desde: rangoDesde, hasta: rangoHasta } = resolverRangoReporte(desdeTexto, hastaTexto);

      const [configuracion, resumen, ventasRango, masVendidos, gananciaCalc, gastosRango] = await Promise.all([
        db.configuracion.findFirst(),
        obtenerResumenHoy(db),
        obtenerVentasCompletadas(db, rangoDesde, rangoHasta),
        obtenerProductosMasVendidos(db, rangoDesde, rangoHasta),
        calcularGananciaEstimada(db, rangoDesde, rangoHasta),
        obtenerGastos(db, rangoDesde, rangoHasta),
      ]);
      const diasAlerta = configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO;
      const [lotesVencidos, lotesPorVencer] = await Promise.all([
        obtenerLotesVencidos(db),
        obtenerLotesPorVencer(db, diasAlerta),
      ]);
      if (cancelado) return;

      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setResumenHoy(resumen);
      setVentas(ventasRango);
      setProductosMasVendidos(masVendidos);
      setGanancia(gananciaCalc);
      setGastos(gastosRango);
      setProductosVencidos(new Set(lotesVencidos.map((l) => l.productoId)).size);
      setProductosPorVencer(new Set(lotesPorVencer.map((l) => l.productoId)).size);
      setRango({ desde: rangoDesde, hasta: rangoHasta });
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [desdeTexto, hastaTexto, recargarClave]);

  if (cargando || !resumenHoy || !rango) return <p className="text-sm text-slate-500">Cargando...</p>;

  const totalGastos = gastos.reduce((acc, gasto) => acc + gasto.monto, 0);
  const gananciaReal = ganancia.ganancia - totalGastos;
  const gruposVentas: GrupoVentas[] = agruparPorMes ? agruparVentasPorMes(ventas) : agruparVentasPorDia(ventas);
  const totalVentas = ventas.reduce((acc, v) => acc + v.total, 0);
  const queryActual = { desde: fechaATexto(rango.desde), hasta: fechaATexto(rango.hasta), agrupar };

  async function exportarVentasCsv() {
    const filas = ventas.map((venta) => [
      venta.id,
      fechaHoraATexto(venta.fecha),
      venta.clienteId ?? "Cliente ocasional",
      venta.formaPago,
      centavosATexto(venta.subtotal),
      centavosATexto(venta.descuento),
      centavosATexto(venta.total),
    ]);
    const csv = filasACsv(["Venta", "Fecha", "Cliente", "Forma de pago", "Subtotal", "Descuento", "Total"], filas);
    await guardarTexto("ventas.csv", csv);
  }

  async function exportarProductosCsv() {
    const filas = productosMasVendidos.map((producto, indice) => [
      indice + 1,
      producto.nombre,
      unidadesMinimasATexto(producto.cantidadVendida, producto.factorConversion),
      producto.unidadMedida,
      centavosATexto(producto.montoVendido),
    ]);
    const csv = filasACsv(["Puesto", "Producto", "Cantidad vendida", "Unidad", "Monto vendido"], filas);
    await guardarTexto("productos-mas-vendidos.csv", csv);
  }

  async function exportarGananciaCsv() {
    const csv = filasACsv(
      ["Ingresos", "Costo estimado", "Ganancia estimada", "Gastos", "Ganancia real"],
      [[
        centavosATexto(ganancia.ingresos),
        centavosATexto(ganancia.costoEstimado),
        centavosATexto(ganancia.ganancia),
        centavosATexto(totalGastos),
        centavosATexto(gananciaReal),
      ]],
    );
    await guardarTexto("ganancia-estimada.csv", csv);
  }

  async function exportarGastosCsv() {
    const filas = gastos.map((gasto) => [gasto.id, fechaHoraATexto(gasto.fecha), gasto.descripcion, centavosATexto(gasto.monto)]);
    const csv = filasACsv(["Gasto", "Fecha", "Descripción", "Monto"], filas);
    await guardarTexto("gastos.csv", csv);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Reportes</h1>

      {(productosVencidos > 0 || productosPorVencer > 0) && (
        <div className="flex flex-wrap gap-2">
          {productosVencidos > 0 && (
            <Link
              href="/productos?vencimiento=vencido"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-danger-600 hover:bg-red-100"
            >
              ⛔ {productosVencidos} producto{productosVencidos === 1 ? "" : "s"} con lotes vencidos
            </Link>
          )}
          {productosPorVencer > 0 && (
            <Link
              href="/productos?vencimiento=porVencer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-warning-500 hover:bg-orange-100"
            >
              ⏳ {productosPorVencer} por vencer
            </Link>
          )}
        </div>
      )}

      <div className="rounded-xl bg-primary-600 p-4 text-white">
        <h2 className="mb-2 text-sm font-semibold">Hoy</h2>
        <p className="text-2xl font-semibold">{centavosATexto(resumenHoy.total, simbolo)}</p>
        <p className="text-sm text-primary-100">
          {resumenHoy.cantidadVentas} venta{resumenHoy.cantidadVentas === 1 ? "" : "s"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-white/10 p-2">
            <p className="text-primary-100">Efectivo</p>
            <p className="font-semibold">{centavosATexto(resumenHoy.efectivo, simbolo)}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2">
            <p className="text-primary-100">Transf./QR</p>
            <p className="font-semibold">{centavosATexto(resumenHoy.transferenciaQr, simbolo)}</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2">
            <p className="text-primary-100">Fiado</p>
            <p className="font-semibold">{centavosATexto(resumenHoy.credito, simbolo)}</p>
          </div>
        </div>
      </div>

      <form action="/reportes" method="GET" className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Desde</label>
          <input
            type="text"
            name="desde"
            defaultValue={fechaATexto(rango.desde)}
            placeholder="dd/mm/aaaa"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Hasta</label>
          <input
            type="text"
            name="hasta"
            defaultValue={fechaATexto(rango.hasta)}
            placeholder="dd/mm/aaaa"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        {agrupar && <input type="hidden" name="agrupar" value={agrupar} />}
        <div className="col-span-2">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Filtrar
          </button>
        </div>
      </form>

      <div className="rounded-xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Ventas</h2>
          <button onClick={exportarVentasCsv} type="button" className="text-xs font-medium text-primary-700 hover:underline">
            Exportar CSV
          </button>
        </div>

        <div className="mb-3 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => router.push(`/reportes?${construirQuery({ ...queryActual, agrupar: undefined })}`)}
            className={`rounded-full px-3 py-1 font-medium ${!agruparPorMes ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-600"}`}
          >
            Por día
          </button>
          <button
            type="button"
            onClick={() => router.push(`/reportes?${construirQuery({ ...queryActual, agrupar: "mes" })}`)}
            className={`rounded-full px-3 py-1 font-medium ${agruparPorMes ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-600"}`}
          >
            Por mes
          </button>
        </div>

        <p className="mb-2 text-sm text-slate-600">
          {ventas.length} venta{ventas.length === 1 ? "" : "s"} · Total{" "}
          <span className="font-semibold text-slate-900">{centavosATexto(totalVentas, simbolo)}</span>
        </p>

        {gruposVentas.length === 0 ? (
          <p className="text-sm text-slate-500">No hay ventas en este período.</p>
        ) : (
          <ul className="space-y-1">
            {gruposVentas.map((grupo) => (
              <li key={grupo.claveOrden} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {grupo.etiqueta} ({grupo.cantidadVentas})
                </span>
                <span className="font-medium text-slate-900">{centavosATexto(grupo.total, simbolo)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Productos más vendidos</h2>
          <button onClick={exportarProductosCsv} type="button" className="text-xs font-medium text-primary-700 hover:underline">
            Exportar CSV
          </button>
        </div>

        {productosMasVendidos.length === 0 ? (
          <p className="text-sm text-slate-500">No hay ventas en este período.</p>
        ) : (
          <ul className="space-y-2">
            {productosMasVendidos.map((producto, indice) => (
              <li key={producto.productoId} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-slate-900">
                    {indice + 1}. {producto.nombre}
                  </p>
                  <p className="text-xs text-slate-500">
                    {unidadesMinimasATexto(producto.cantidadVendida, producto.factorConversion)} {producto.unidadMedida} vendidos
                  </p>
                </div>
                <span className="shrink-0 font-medium text-slate-900">{centavosATexto(producto.montoVendido, simbolo)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Ganancia estimada</h2>
          <button onClick={exportarGananciaCsv} type="button" className="text-xs font-medium text-primary-700 hover:underline">
            Exportar CSV
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Calculada con el precio de compra actual de cada producto (no queda guardado el costo histórico).
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Ingresos</span>
            <span>{centavosATexto(ganancia.ingresos, simbolo)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Costo estimado</span>
            <span>{centavosATexto(ganancia.costoEstimado, simbolo)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Ganancia estimada</span>
            <span>{centavosATexto(ganancia.ganancia, simbolo)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Gastos</span>
            <span>{centavosATexto(totalGastos, simbolo)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
            <span>Ganancia real</span>
            <span>{centavosATexto(gananciaReal, simbolo)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Gastos</h2>
          {gastos.length > 0 && (
            <button onClick={exportarGastosCsv} type="button" className="text-xs font-medium text-primary-700 hover:underline">
              Exportar CSV
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Opcional: registralos solo si querés ver la ganancia real, no hace falta para vender.
        </p>

        <GastoForm onExito={recargar} />

        {gastos.length > 0 && (
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {gastos.map((gasto) => (
              <li key={gasto.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-slate-900">{gasto.descripcion}</p>
                  <p className="text-xs text-slate-500">{fechaATexto(gasto.fecha)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium text-danger-600">{centavosATexto(gasto.monto, simbolo)}</span>
                  <BorrarGastoButton gastoId={gasto.id} onExito={recargar} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ReportesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <ReportesContenido />
    </Suspense>
  );
}
