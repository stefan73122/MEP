export function PantallaAppInvalida() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">⚠️</div>
      <h1 className="text-base font-semibold text-slate-900">Aplicación no válida</h1>
      <p className="max-w-xs text-sm text-slate-500">
        Este instalador fue modificado y no puede usarse. Desinstalá esta copia y volvé a instalar la versión
        original.
      </p>
    </div>
  );
}
