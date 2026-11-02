import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// Excel que llega desde otra app con "Abrir con" / "Compartir" (WhatsApp,
// Archivos, Gmail...). La parte nativa está en
// android/app/src/main/java/com/mitienda/app/ArchivoEntrantePlugin.java.
interface ArchivoEntrantePlugin {
  hayPendiente(): Promise<{ hay: boolean }>;
  tomarPendiente(): Promise<{ nombre?: string; datosBase64?: string }>;
  addListener(evento: "archivoRecibido", escuchar: () => void): Promise<PluginListenerHandle>;
}

const ArchivoEntrante = registerPlugin<ArchivoEntrantePlugin>("ArchivoEntrante");

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// En el navegador (`next dev`) no hay plugin nativo: nunca llega nada.
const esNativo = () => Capacitor.isNativePlatform();

export async function hayArchivoEntrante(): Promise<boolean> {
  if (!esNativo()) return false;
  const { hay } = await ArchivoEntrante.hayPendiente();
  return hay;
}

// Devuelve el archivo pendiente y lo descarta: se entrega una sola vez.
export async function tomarArchivoEntrante(): Promise<File | null> {
  if (!esNativo()) return null;
  const { nombre, datosBase64 } = await ArchivoEntrante.tomarPendiente();
  if (!datosBase64) return null;

  const binario = atob(datosBase64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new File([bytes], nombre ?? "productos.xlsx", { type: MIME_XLSX });
}

// Avisa cuando llega un archivo con la app ya abierta. Devuelve la función
// para dejar de escuchar.
export function alRecibirArchivoEntrante(escuchar: () => void): () => void {
  if (!esNativo()) return () => {};
  const listener = ArchivoEntrante.addListener("archivoRecibido", escuchar);
  return () => {
    listener.then((h) => h.remove());
  };
}
