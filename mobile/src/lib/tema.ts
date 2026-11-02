import { Preferences } from "@capacitor/preferences";

// "sistema": sigue el modo claro/oscuro del teléfono. Es el valor por defecto
// mientras el usuario no elija uno fijo en Ajustes.
export type Tema = "sistema" | "light" | "dark";

const CLAVE_TEMA = "tema";

export async function leerTema(): Promise<Tema> {
  const { value } = await Preferences.get({ key: CLAVE_TEMA });
  return value === "light" || value === "dark" ? value : "sistema";
}

// El CSS trae el tema oscuro como base en :root y sólo redefine variables
// bajo [data-theme="light"] (ver globals.css), así que "oscuro" es no tener
// el atributo puesto.
function pintar(claro: boolean): void {
  if (claro) document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

let dejarDeSeguirSistema: (() => void) | null = null;

export function aplicarTema(tema: Tema): void {
  dejarDeSeguirSistema?.();
  dejarDeSeguirSistema = null;

  if (tema !== "sistema") {
    pintar(tema === "light");
    return;
  }

  // Con "sistema" también se acompaña el cambio en vivo (ej. el modo oscuro
  // programado del teléfono que se activa con la app abierta).
  const consulta = window.matchMedia("(prefers-color-scheme: light)");
  pintar(consulta.matches);
  const escuchar = (evento: MediaQueryListEvent) => pintar(evento.matches);
  consulta.addEventListener("change", escuchar);
  dejarDeSeguirSistema = () => consulta.removeEventListener("change", escuchar);
}

export async function guardarTema(tema: Tema): Promise<void> {
  aplicarTema(tema);
  await Preferences.set({ key: CLAVE_TEMA, value: tema });
}
