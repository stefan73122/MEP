// Firma de certificados de licencia (JWT ES256). Sin dependencias: solo
// WebCrypto, que existe igual en Deno (Edge Functions) y en Node, así la
// prueba local (scripts/probar-firma.mts) usa exactamente este código.

export type ClaveFirma = { kid: string; clave: CryptoKey };

// El secreto es el JWK privado (EC P-256) en JSON, codificado en base64 para
// que sobreviva intacto a archivos .env y a la terminal. Lo genera
// scripts/generar-claves-licencia.mjs.
export async function importarClavePrivada(codificada: string): Promise<ClaveFirma> {
  const jwk = JSON.parse(atob(codificada)) as JsonWebKey & { kid?: string };
  if (!jwk.kid || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d) {
    throw new Error("La clave privada no es un JWK privado EC P-256 con kid");
  }
  const clave = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return { kid: jwk.kid, clave };
}

const codificador = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function firmarCertificado({ kid, clave }: ClaveFirma, datos: Record<string, unknown>): Promise<string> {
  const encabezado = base64url(codificador.encode(JSON.stringify({ alg: "ES256", typ: "JWT", kid })));
  const cuerpo = base64url(codificador.encode(JSON.stringify(datos)));
  // WebCrypto devuelve la firma ECDSA como r||s (64 bytes): justo el formato
  // que usa JWS para ES256, así que no hace falta convertir nada.
  const firma = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    clave,
    codificador.encode(`${encabezado}.${cuerpo}`),
  );
  return `${encabezado}.${cuerpo}.${base64url(new Uint8Array(firma))}`;
}
