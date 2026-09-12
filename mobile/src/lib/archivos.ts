import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function uint8ArrayABase64(bytes: Uint8Array): string {
  let binario = "";
  const tamanoChunk = 0x8000;
  for (let i = 0; i < bytes.length; i += tamanoChunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanoChunk));
  }
  return btoa(binario);
}

function descargarEnNavegador(nombre: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

// Genera el archivo y, en el APK, abre la hoja para compartirlo/guardarlo
// (no hay barra de descargas como en un navegador). En web (desarrollo) hace
// una descarga normal.
export async function guardarTexto(nombre: string, contenido: string, mime = "text/csv"): Promise<void> {
  if (Capacitor.getPlatform() === "web") {
    descargarEnNavegador(nombre, new Blob([contenido], { type: mime }));
    return;
  }

  const resultado = await Filesystem.writeFile({
    path: nombre,
    data: contenido,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: nombre, url: resultado.uri });
}

export async function guardarBinario(nombre: string, contenido: ArrayBuffer | Uint8Array, mime: string): Promise<void> {
  const bytes = contenido instanceof Uint8Array ? contenido : new Uint8Array(contenido);

  if (Capacitor.getPlatform() === "web") {
    descargarEnNavegador(nombre, new Blob([bytes as BlobPart], { type: mime }));
    return;
  }

  const resultado = await Filesystem.writeFile({
    path: nombre,
    data: uint8ArrayABase64(bytes),
    directory: Directory.Cache,
  });
  await Share.share({ title: nombre, url: resultado.uri });
}
