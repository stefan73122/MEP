import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import { ConfiguracionForm } from "./ConfiguracionForm";
import { PinForm } from "./PinForm";

export default async function ConfiguracionPage() {
  await requireAcceso();

  const configuracion = await db.configuracion.findFirst();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Configuración</h1>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Negocio</h2>
        <ConfiguracionForm
          nombreNegocio={configuracion?.nombreNegocio ?? "Mi Tienda"}
          moneda={configuracion?.moneda ?? "BOB"}
          simboloMoneda={configuracion?.simboloMoneda ?? "Bs"}
          diasAlertaVencimiento={configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO}
        />
      </div>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">PIN de acceso</h2>
        <PinForm pinConfigurado={!!configuracion?.pinHash} />
      </div>
    </div>
  );
}
