import { ServicioForm } from "../ServicioForm";

export default function NuevoServicioPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Nuevo servicio</h1>
      <div className="rounded-xl bg-white p-4">
        <ServicioForm />
      </div>
    </div>
  );
}
