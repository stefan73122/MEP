"use client";

import { useState } from "react";

// Prueba mínima de la etapa 2: confirma que Capacitor + el plugin de SQLite
// funcionan (tanto en el navegador, vía jeep-sqlite, como en el APK real).
// No es ninguna pantalla definitiva del sistema.
async function probarConexionSqlite(): Promise<string> {
  const { Capacitor } = await import("@capacitor/core");
  const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");

  const esWeb = Capacitor.getPlatform() === "web";

  if (esWeb) {
    await import("jeep-sqlite");
    if (!document.querySelector("jeep-sqlite")) {
      document.body.appendChild(document.createElement("jeep-sqlite"));
    }
    await customElements.whenDefined("jeep-sqlite");
  }

  const sqlite = new SQLiteConnection(CapacitorSQLite);
  if (esWeb) {
    await sqlite.initWebStore();
  }

  const yaExiste = (await sqlite.isConnection("prueba_etapa2", false)).result;
  const db = yaExiste
    ? await sqlite.retrieveConnection("prueba_etapa2", false)
    : await sqlite.createConnection("prueba_etapa2", false, "no-encryption", 1, false);

  await db.open();
  await db.execute("CREATE TABLE IF NOT EXISTS prueba (id INTEGER PRIMARY KEY, mensaje TEXT)");
  await db.run("INSERT INTO prueba (mensaje) VALUES (?)", ["Hola desde SQLite"]);
  const filas = await db.query("SELECT * FROM prueba");
  await db.close();

  return `SQLite funciona (${Capacitor.getPlatform()}). Filas guardadas: ${filas.values?.length ?? 0}`;
}

export default function InicioPage() {
  const [resultado, setResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarClick() {
    setCargando(true);
    setResultado(null);
    try {
      const mensaje = await probarConexionSqlite();
      setResultado(mensaje);
    } catch (error) {
      setResultado(`Error: ${(error as Error).message}`);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Mi Tienda</h1>
      <p className="max-w-sm text-sm text-slate-500">
        Base de la app para Android (Capacitor + Next.js exportado como sitio estático).
        Todavía no tiene ningún módulo del sistema migrado.
      </p>
      <button
        type="button"
        onClick={manejarClick}
        disabled={cargando}
        className="rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
      >
        {cargando ? "Probando..." : "Probar SQLite"}
      </button>
      {resultado && <p className="max-w-sm text-xs text-slate-600">{resultado}</p>}
    </main>
  );
}
