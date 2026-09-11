import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { centavosATexto, centavosATextoEditable } from "@/lib/money";
import { fechaATexto } from "@/lib/dates";
import { calcularSaldoPendiente } from "@/lib/creditos";
import { EditarClienteForm } from "./EditarClienteForm";
import { EstadoClienteToggle } from "./EstadoClienteToggle";
import { PagoForm } from "./PagoForm";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAcceso();
  const { id } = await params;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId)) notFound();

  const [cliente, configuracion, ventasCredito, pagos, saldoPendiente] = await Promise.all([
    db.cliente.findUnique({ where: { id: clienteId } }),
    db.configuracion.findFirst(),
    db.venta.findMany({
      where: { clienteId, formaPago: "CREDITO" },
      include: { pagosAplicados: true },
      orderBy: { fecha: "desc" },
    }),
    db.pago.findMany({
      where: { clienteId },
      orderBy: { fecha: "desc" },
    }),
    calcularSaldoPendiente(db, clienteId),
  ]);

  if (!cliente) notFound();

  const simbolo = configuracion?.simboloMoneda ?? "Bs";

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
            <p className="font-semibold text-slate-900">
              {centavosATexto(cliente.limiteCredito, simbolo)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <EstadoClienteToggle clienteId={cliente.id} activo={cliente.activo} />
        </div>
      </div>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Editar datos</h2>
        <EditarClienteForm
          clienteId={cliente.id}
          nombre={cliente.nombre}
          telefono={cliente.telefono}
          limiteCreditoTexto={centavosATextoEditable(cliente.limiteCredito)}
        />
      </div>

      {cliente.activo && saldoPendiente > 0 && (
        <div className="rounded-xl bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Registrar pago</h2>
          <PagoForm clienteId={cliente.id} />
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
                    href={`/ventas/${venta.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2 text-sm hover:border-primary-300"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        Venta #{venta.id} · {fechaATexto(venta.fecha)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {venta.estado === "ANULADA" ? "Anulada" : "Completada"} · Total:{" "}
                        {centavosATexto(venta.total, simbolo)}
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
                  <span className="font-medium text-slate-900">
                    {centavosATexto(pago.monto, simbolo)}
                  </span>
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
