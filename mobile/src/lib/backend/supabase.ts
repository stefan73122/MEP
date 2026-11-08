import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { SUPABASE_CLAVE_PUBLICABLE, SUPABASE_URL } from "./config";

// Dónde guarda supabase-js la sesión (access + refresh token). Con nombre
// propio para poder saber si hay sesión sin pasar por getSession(), que sin
// conexión puede intentar refrescar el token y tardar.
export const CLAVE_SESION = "mip.sesion";

// Las preferencias nativas (SharedPreferences en Android, privadas de la
// app) son más duraderas que el localStorage del WebView, que Android puede
// vaciar si falta espacio.
const almacenamiento = {
  getItem: async (clave: string) => (await Preferences.get({ key: clave })).value,
  setItem: async (clave: string, valor: string) => {
    await Preferences.set({ key: clave, value: valor });
  },
  removeItem: async (clave: string) => {
    await Preferences.remove({ key: clave });
  },
};

let cliente: SupabaseClient | null = null;

// Se crea recién al primer uso (siempre desde un efecto o un evento, en el
// teléfono): al importarse durante `next build` no hay Capacitor ni
// almacenamiento.
//
// autoRefreshToken: false — la app solo usa la sesión para renovar la
// licencia de vez en cuando; getSession() ya refresca el token vencido justo
// antes de cada uso, sin dejar un temporizador corriendo en segundo plano.
export function obtenerSupabase(): SupabaseClient {
  cliente ??= createClient(SUPABASE_URL, SUPABASE_CLAVE_PUBLICABLE, {
    auth: {
      storage: almacenamiento,
      storageKey: CLAVE_SESION,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cliente;
}

export async function haySesionGuardada(): Promise<boolean> {
  const { value } = await Preferences.get({ key: CLAVE_SESION });
  return !!value;
}
