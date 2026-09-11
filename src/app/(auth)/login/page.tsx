import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Mi Tienda</h1>
        <p className="mb-6 text-sm text-slate-500">Ingresá tu PIN para continuar</p>
        <LoginForm />
      </div>
    </div>
  );
}
