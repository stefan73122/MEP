"use client";

import { useId, useState } from "react";
import { fechaATexto } from "@/lib/dates";
import { IconCalendario } from "@/components/ui/icons";

function aIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function deIso(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

type CampoFechaProps = {
  id?: string;
  label: string;
  required?: boolean;
  min?: Date;
  className?: string;
  // Modo no controlado: pasar `name` — el campo emite un input oculto con
  // ese nombre y el valor en texto "dd/mm/aaaa", listo para FormData/Zod
  // exactamente como un <input type="text"> de toda la vida.
  name?: string;
  defaultValue?: Date;
  // Modo controlado: pasar `value` + `onChange` en vez de `name`.
  value?: Date;
  onChange?: (fecha: Date) => void;
};

// Selector de fecha visual: usa <input type="date"> real (así se abre el
// calendario nativo del sistema operativo/WebView — días grandes y atajo
// de año ya incluidos de fábrica) pero transparente y superpuesto sobre una
// caja que siempre muestra el valor en formato dd/mm/aaaa, sin depender del
// locale del dispositivo para lo que se ve con el selector cerrado.
export function CampoFecha({ id, label, required, min, className, name, defaultValue, value, onChange }: CampoFechaProps) {
  const idAuto = useId();
  const inputId = id ?? idAuto;
  const controlado = value !== undefined && onChange !== undefined;

  const [valorInterno, setValorInterno] = useState<Date>(() => defaultValue ?? new Date());
  const valorActual = controlado ? value! : valorInterno;

  function manejarCambio(iso: string) {
    if (!iso) return;
    const fecha = deIso(iso);
    if (controlado) {
      onChange!(fecha);
    } else {
      setValorInterno(fecha);
    }
  }

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1">
        <div className="flex h-11 items-center justify-between rounded-lg border border-slate-300 px-3">
          <span className="text-sm text-slate-900">{fechaATexto(valorActual)}</span>
          <IconCalendario className="text-slate-400" />
        </div>
        <input
          id={inputId}
          type="date"
          required={required}
          min={min ? aIso(min) : undefined}
          value={aIso(valorActual)}
          onChange={(e) => manejarCambio(e.target.value)}
          aria-label={label}
          className="absolute inset-0 z-10 h-11 w-full cursor-pointer opacity-0"
        />
      </div>
      {name && <input type="hidden" name={name} value={fechaATexto(valorActual)} />}
    </div>
  );
}
