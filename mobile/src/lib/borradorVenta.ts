import { Preferences } from "@capacitor/preferences";
import type { FormaPago } from "./constants";

const CLAVE_BORRADOR = "borradorVenta";
const DEBOUNCE_MS = 400;

export type ItemBorrador = {
  productoId: number;
  sku: string;
  nombre: string;
  unidadMedida: string;
  factorConversion: number;
  precioVenta: number;
  stockActual: number;
  proximoVencimiento: string | null;
  cantidadTexto: string;
  descuentoTexto: string;
};

export type BorradorVenta = {
  carrito: ItemBorrador[];
  clienteId: string;
  formaPago: FormaPago;
  descuentoTotalTexto: string;
};

// Venta a medio registrar: se guarda en las preferencias nativas del
// dispositivo (sobrevive a que Android mate el proceso de la app, no solo a
// cambiar de pantalla) para que nunca se pierda un carrito por accidente —
// ni por el swipe entre pantallas, ni por una interrupción del sistema.
// Solo se guardan los 4 campos que forman la venta en sí; los estados
// efímeros de las mini-tarjetas "nuevo cliente"/"nuevo producto" no.
export async function guardarBorrador(borrador: BorradorVenta): Promise<void> {
  await Preferences.set({ key: CLAVE_BORRADOR, value: JSON.stringify(borrador) });
}

export async function leerBorrador(): Promise<BorradorVenta | null> {
  const { value } = await Preferences.get({ key: CLAVE_BORRADOR });
  if (!value) return null;
  try {
    return JSON.parse(value) as BorradorVenta;
  } catch {
    return null;
  }
}

export async function borrarBorrador(): Promise<void> {
  await Preferences.remove({ key: CLAVE_BORRADOR });
}

// Debounce simple: evita escribir en cada tecla (en el dispositivo real,
// cada escritura de Preferences es I/O nativo, no una variable en memoria).
let temporizador: ReturnType<typeof setTimeout> | null = null;
export function guardarBorradorConDemora(borrador: BorradorVenta): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    guardarBorrador(borrador);
  }, DEBOUNCE_MS);
}
