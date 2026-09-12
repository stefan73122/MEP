"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { centavosATexto } from "@/lib/money";
import { fechaHoraATexto, finDelDia, inicioDelDia, textoAFecha } from "@/lib/dates";
import type { Cliente, VentaConCliente } from "@/lib/db/types";
import { CampoFecha } from "@/components/forms/CampoFecha";

function intentarParsear(texto: string | undefined): Date | undefined {
  if (!texto) return undefined;
  try {
    return textoAFecha(texto);
  } catch {
    return undefined;
  }
}

const ETIQUETAS_FORMA_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA_QR: "Transferencia/QR",
  CREDITO: "Crédito",
};

function VentasContenido() {
  const searchParams = useSearchParams();
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const clienteId = searchParams.get("clienteId") ?? undefined;
  const formaPago = searchParams.get("formaPago") ?? undefined;

  const [cargando, setCargando] = useState(true);
  const [simbolo, setSimbolo] = useState("Bs");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<VentaConCliente[]>([]);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const filtro: Parameters<typeof db.venta.findManyConCliente>[0] = {};
      if (desde) {
        try {
          filtro.fechaGte = inicioDelDia(textoAFecha(desde));
        } catch {
          // fecha inválida en la URL: se ignora el filtro
        }
      }
      if (hasta) {
        try {
          filtro.fechaLte = finDelDia(textoAFecha(hasta));
        } catch {
          // fecha inválida en la URL: se ignora el filtro
        }
      }
      if (clienteId) filtro.clienteId = Number(clienteId);
      if (formaPago) filtro.formaPago = formaPago as VentaConCliente["formaPago"];

      const [configuracion, listaClientes, listaVentas] = await Promise.all([
        db.configuracion.findFirst(),
        db.cliente.findMany({ activo: true }, true),
        db.venta.findManyConCliente(filtro, { orderBy: "desc", take: 100 }),
      ]);
      if (cancelado) return;
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setClientes(listaClientes);
      setVentas(listaVentas);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [desde, hasta, clienteId, formaPago]);

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Ventas</h1>
        <Link
          href="/ventas/nueva"
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          + Nueva venta
        </Link>
      </div>

      <form action="/ventas" method="GET" className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 sm:grid-cols-4">
        <CampoFecha name="desde" label="Desde" defaultValue={intentarParsear(desde)} />
        <CampoFecha name="hasta" label="Hasta" defaultValue={intentarParsear(hasta)} />
        <div>
          <label className="block text-xs font-medium text-slate-500">Cliente</label>
          <select
            name="clienteId"
            defaultValue={clienteId ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Forma de pago</label>
          <select
            name="formaPago"
            defaultValue={formaPago ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA_QR">Transferencia/QR</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:w-auto"
          >
            Filtrar
          </button>
        </div>
      </form>

      {ventas.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No se encontraron ventas con estos filtros.</p>
      ) : (
        <ul className="space-y-2">
          {ventas.map((venta) => (
            <li key={venta.id}>
              <Link
                href={`/ventas/detalle?id=${venta.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    Venta #{venta.id} · {venta.cliente?.nombre ?? "Cliente ocasional"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fechaHoraATexto(venta.fecha)} · {ETIQUETAS_FORMA_PAGO[venta.formaPago] ?? venta.formaPago}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-slate-900">{centavosATexto(venta.total, simbolo)}</p>
                  {venta.estado === "ANULADA" && <p className="text-xs font-medium text-danger-600">Anulada</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VentasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <VentasContenido />
    </Suspense>
  );
}
