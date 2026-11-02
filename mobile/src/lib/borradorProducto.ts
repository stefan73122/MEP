import { Preferences } from "@capacitor/preferences";

const CLAVE_BORRADOR = "borradorProducto";
const DEBOUNCE_MS = 300;

// Campos del formulario "Nuevo producto" tal cual salen del FormData (todo
// texto; un checkbox marcado viene como "on" y sin marcar directamente no
// viene).
export type BorradorProducto = Record<string, string>;

// Producto a medio cargar: igual que el borrador de la venta (ver
// borradorVenta.ts), se guarda en las preferencias nativas para que no se
// pierda si Android mata el proceso mientras la app está minimizada (al
// minimizar sin más la pantalla queda montada, ver AuthGate).
export async function leerBorradorProducto(): Promise<BorradorProducto | null> {
  const { value } = await Preferences.get({ key: CLAVE_BORRADOR });
  if (!value) return null;
  try {
    return JSON.parse(value) as BorradorProducto;
  } catch {
    return null;
  }
}

let temporizador: ReturnType<typeof setTimeout> | null = null;

export async function borrarBorradorProducto(): Promise<void> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  await Preferences.remove({ key: CLAVE_BORRADOR });
}

// Debounce simple: evita una escritura nativa por cada tecla.
export function guardarBorradorProductoConDemora(borrador: BorradorProducto): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    Preferences.set({ key: CLAVE_BORRADOR, value: JSON.stringify(borrador) });
  }, DEBOUNCE_MS);
}
