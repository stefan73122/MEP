import { NuevoProductoForm } from "./NuevoProductoForm";

export default function NuevoProductoPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Nuevo producto</h1>
      <div className="rounded-xl bg-white p-4">
        <NuevoProductoForm />
      </div>
    </div>
  );
}
