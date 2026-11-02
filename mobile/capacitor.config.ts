import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mitienda.app",
  appName: "MIP",
  webDir: "out",
  // Mismo oscuro que el fondo de arranque nativo (ver styles.xml) y el de
  // la app (--mt-bg-app): sin esto, el WebView arranca con fondo blanco por
  // defecto y se ve un parpadeo blanco entre el arranque nativo y que el
  // CSS de la app termine de cargar.
  backgroundColor: "#141416",
  android: {
    backgroundColor: "#141416",
  },
  plugins: {
    CapacitorSQLite: {
      // La base se abre siempre como "no-encryption" (ver src/lib/db/sqlite.ts).
      // Con el cifrado habilitado (valor por defecto del plugin), al arrancar
      // crea una clave en el Keystore de Android aunque nunca se use, y en
      // algunos teléfonos eso falla: el plugin queda sin cargar y la app no
      // puede abrir la base ("CapacitorSQLitePlugin: null").
      androidIsEncryption: false,
    },
  },
};

export default config;
