// Datos PÚBLICOS del backend (Supabase). Van dentro del APK a propósito, y
// por eso pueden estar en el repositorio:
// - La URL y la clave publicable solo identifican el proyecto: no dan acceso
//   a nada por sí solas (las tablas están protegidas con RLS y el registro
//   público de cuentas está desactivado).
// - Las claves públicas de licencia solo sirven para VERIFICAR certificados,
//   no para fabricarlos: la clave privada vive únicamente en los secretos de
//   Supabase (ver scripts/generar-claves-licencia.mjs).
//
// Nunca pongas acá la clave secreta (sb_secret_...) ni la service_role.

export const SUPABASE_URL = "https://mofhbzymjfpakhbejmuc.supabase.co";

export const SUPABASE_CLAVE_PUBLICABLE = "sb_publishable_XL8NUIp1K0oHxAbbfYa00A_GRZTe9ui";

// Claves con las que se aceptan certificados, por "kid" (el certificado dice
// con cuál se firmó). Para rotar la clave se agrega la nueva acá, se publica
// la app, y recién después se cambia la privada en Supabase.
export const CLAVES_PUBLICAS_LICENCIA: Record<string, JsonWebKey> = {
  "mip-20261108": {
    kty: "EC",
    crv: "P-256",
    x: "xLnTNZ6PFTQn0e-0Wb_fPjx3W9sQs2ElVlyv3q29fV0",
    y: "NYyyHLGpVWH7rEG-T5s7VD23WlmNlszqVwIOdoA1u_E",
  },
};
