import { requireAcceso, pinConfigurado } from "@/lib/auth";
import { db } from "@/lib/db";
import { NavBar } from "@/components/layout/NavBar";
import { LogoutButton } from "@/components/layout/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAcceso();
  const [configuracion, hayPin] = await Promise.all([db.configuracion.findFirst(), pinConfigurado()]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <NavBar />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {configuracion?.nombreNegocio ?? "Mi Tienda"}
          </p>
          {hayPin && <LogoutButton />}
        </header>

        <main className="flex-1 px-4 py-4 pb-20 md:pb-4">{children}</main>
      </div>
    </div>
  );
}
