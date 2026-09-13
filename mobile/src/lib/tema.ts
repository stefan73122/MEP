import { Preferences } from "@capacitor/preferences";

export type Tema = "light" | "dark";

const CLAVE_TEMA = "tema";

export async function leerTema(): Promise<Tema> {
  const { value } = await Preferences.get({ key: CLAVE_TEMA });
  return value === "light" ? "light" : "dark";
}

// El CSS trae el tema oscuro como base en :root y sólo redefine variables
// bajo [data-theme="light"] (ver globals.css), así que "oscuro" es no tener
// el atributo puesto.
export function aplicarTema(tema: Tema): void {
  if (tema === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

export async function guardarTema(tema: Tema): Promise<void> {
  aplicarTema(tema);
  await Preferences.set({ key: CLAVE_TEMA, value: tema });
}
