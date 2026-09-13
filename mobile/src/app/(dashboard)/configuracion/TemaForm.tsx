"use client";

import { useEffect, useState } from "react";
import { guardarTema, leerTema, type Tema } from "@/lib/tema";

const OPCIONES: { valor: Tema; etiqueta: string }[] = [
  { valor: "light", etiqueta: "Claro" },
  { valor: "dark", etiqueta: "Oscuro" },
];

export function TemaForm() {
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    leerTema().then(setTema);
  }, []);

  if (tema === null) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {OPCIONES.map((opcion) => (
        <label
          key={opcion.valor}
          className={`flex min-w-0 -skew-x-[7deg] cursor-pointer items-center justify-center rounded-lg border px-1 py-2.5 text-center text-sm font-medium ${
            tema === opcion.valor
              ? "border-primary-500 bg-primary-50 text-primary-700"
              : "border-slate-300 text-slate-600"
          }`}
        >
          <input
            type="radio"
            name="tema"
            value={opcion.valor}
            checked={tema === opcion.valor}
            onChange={() => {
              setTema(opcion.valor);
              guardarTema(opcion.valor);
            }}
            className="sr-only"
          />
          <span className="skew-x-[7deg] leading-tight">{opcion.etiqueta}</span>
        </label>
      ))}
    </div>
  );
}
