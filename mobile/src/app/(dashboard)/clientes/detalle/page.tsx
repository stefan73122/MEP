"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { centavosATexto, centavosATextoEditable } from "@/lib/money";
import { fechaATexto } from "@/lib/dates";
import { calcularSaldoPendiente } from "@/lib/creditos";
import type { Cliente, Pago, VentaConPagos } from "@/lib/db/types";
import { EditarClienteForm } from "./EditarClienteForm";
import { EstadoClienteToggle } from "./EstadoClienteToggle";
import { PagoForm } from "./PagoForm";

function ClienteDetalleContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));

  const [cargando, setCargando] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [simbolo, setSimbolo] = useState("Bs");
  const [ventasCredito, setVentasCredito] = useState<VentaConPagos[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [saldoPendiente, setSaldoPendiente] = useState(0);
  const [recargarClave, setRecargarClave] = useState(0);

  const recargar = useCallback(() => setRecargarClave((c) => c + 1), []);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      router.replace("/clientes");
      return;
    }
    let cancelado = false;
    async function cargar() {
      const [c, configuracion, ventas, pagosCliente, saldo] = await Promise.all([
        db.cliente.findUnique(id),
        db.configuracion.findFirst(),
        db.venta.findManyConPagos({ clienteId: id, formaPago: "CREDITO" }, { orderBy: "desc" }),
        db.pago.findByCliente(id),
        calcularSaldoPendiente(db, id),
      ]);
      if (!c) {
        router.replace("/clientes");
        return;
      }
      if (cancelado) return;
      setCliente(c);
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setVentasCredito(ventas);
      setPagos(pagosCliente);
      setSaldoPendiente(saldo);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [id, recargarClave, router]);

  if (cargando || !cliente) return <p className="text-sm text-slate-500">Cargando...</p>;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/clientes" className="text-sm text-slate-500 hover:underline">
        ← Clientes
      </Link>

      <div className="rounded-xl bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{cliente.nombre}</h1>
            {cliente.telefono && <p className="text-xs text-slate-500">{cliente.telefono}</p>}
          </div>
          {!cliente.activo && (
            <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
              Inactivo
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500">Saldo pendiente</p>
            <p className={`font-semibold ${saldoPendiente > 0 ? "text-danger-600" : "text-slate-900"}`}>
              {centavosATexto(saldoPendiente, simbolo)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500">Límite de crédito</p>
            <p className="font-semibold text-slate-900">{centavosATexto(cliente.limiteCredito, simbolo)}</p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <EstadoClienteToggle clienteId={cliente.id} activo={cliente.activo} onExito={recargar} />
        </div>
      </div>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Editar datos</h2>
        <EditarClienteForm
          clienteId={cliente.id}
          nombre={cliente.nombre}
          telefono={cliente.telefono}
          limiteCreditoTexto={centavosATextoEditable(cliente.limiteCredito)}
          onExito={recargar}
        />
      </div>

      {cliente.activo && saldoPendiente > 0 && (
        <div className="rounded-xl bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Registrar pago</h2>
          <PagoForm clienteId={cliente.id} onExito={recargar} />
        </div>
      )}

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Ventas a crédito</h2>
        {ventasCredito.length === 0 ? (
          <p className="text-sm text-slate-500">Este cliente todavía no compró a crédito.</p>
        ) : (
          <ul className="space-y-2">
            {ventasCredito.map((venta) => {
              const aplicado = venta.pagosAplicados.reduce((s, p) => s + p.montoAplicado, 0);
              const pendiente = venta.total - aplicado;
              return (
                <li key={venta.id}>
                  <Link
                    href={`/ventas/detalle?id=${venta.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2 text-sm hover:border-primary-300"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        Venta #{venta.id} · {fechaATexto(venta.fecha)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {venta.estado === "ANULADA" ? "Anulada" : "Completada"} · Total: {centavosATexto(venta.total, simbolo)}
                      </p>
                    </div>
                    {venta.estado === "COMPLETADA" && (
                      <p className={pendiente > 0 ? "font-medium text-danger-600" : "text-slate-500"}>
                        {pendiente > 0 ? `Debe ${centavosATexto(pendiente, simbolo)}` : "Pagada"}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Pagos recibidos</h2>
        {pagos.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no se registraron pagos.</p>
        ) : (
          <ul className="space-y-2">
            {pagos.map((pago) => (
              <li key={pago.id} className="rounded-lg border border-slate-100 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{centavosATexto(pago.monto, simbolo)}</span>
                  <span className="text-xs text-slate-500">{fechaATexto(pago.fecha)}</span>
                </div>
                {pago.observacion && <p className="text-xs text-slate-500">{pago.observacion}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ClienteDetallePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <ClienteDetalleContenido />
    </Suspense>
  );
}
