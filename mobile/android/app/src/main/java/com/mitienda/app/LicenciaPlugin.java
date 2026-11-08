package com.mitienda.app;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.MessageDigest;

// Plugin nativo de licencia. Solo comprueba que el APK sea el original
// (firma del certificado de compilación). La licencia en sí ya no se valida
// acá: la decide el servidor (Supabase, Edge Function "licencia") y la app la
// verifica con un certificado firmado — ver src/lib/licencia.ts.
//
// Antes este archivo tenía la "palabra secreta" para validar claves de
// activación: se quitó porque cualquier cosa dentro del APK se puede extraer.
@CapacitorPlugin(name = "LicenciaNativa")
public class LicenciaPlugin extends Plugin {

    // Huellas SHA-256 (formato de "keytool -list -v") de los certificados con
    // los que se acepta que esté firmado este APK. Hoy son dos claves de
    // DEPURACIÓN, que sirven solo para probar:
    // - 1D:AB:…: la que trae el código desde el 2026-09-12. Es del keystore de
    //   depuración de la computadora donde se agregó, no de la PC actual.
    // - 36:77:…: la del keystore de depuración de la PC donde se clonó el repo
    //   el 2026-11-07 (%USERPROFILE%\.android\debug.keystore), comprobada con
    //   "apksigner verify --print-certs" sobre un APK compilado ahí.
    // Antes de entregar un APK firmado de verdad a un cliente, hay que dejar acá
    // solo la huella del keystore de producción. No son secretos: son públicas
    // por naturaleza (cualquiera las lee de un APK).
    private static final String[] HUELLAS_FIRMA_ACEPTADAS = {
        "1D:AB:B3:33:96:28:3A:1C:1F:93:F8:8B:7C:6A:01:E5:97:C0:CB:BE:E6:D2:2B:78:2B:2F:3D:02:FD:77:55:25",
        "36:77:F1:6B:F2:1B:62:AF:A8:B4:BD:AE:CE:BA:98:E4:29:E8:60:32:07:E1:04:B2:F1:27:45:8E:29:95:88:4B",
    };

    @PluginMethod
    public void verificarFirma(PluginCall call) {
        boolean valida = false;
        try {
            String huellaActual = obtenerHuellaFirmaActual();
            if (huellaActual != null) {
                for (String aceptada : HUELLAS_FIRMA_ACEPTADAS) {
                    if (huellaActual.equalsIgnoreCase(aceptada)) {
                        valida = true;
                        break;
                    }
                }
            }
        } catch (Exception error) {
            valida = false;
        }
        JSObject resultado = new JSObject();
        resultado.put("valida", valida);
        call.resolve(resultado);
    }

    @SuppressWarnings("deprecation")
    private String obtenerHuellaFirmaActual() throws Exception {
        PackageManager administradorPaquetes = getContext().getPackageManager();
        String paquete = getAppId();
        byte[] certificado;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageInfo info = administradorPaquetes.getPackageInfo(paquete, PackageManager.GET_SIGNING_CERTIFICATES);
            Signature[] firmas = info.signingInfo.getApkContentsSigners();
            certificado = firmas[0].toByteArray();
        } else {
            PackageInfo info = administradorPaquetes.getPackageInfo(paquete, PackageManager.GET_SIGNATURES);
            certificado = info.signatures[0].toByteArray();
        }

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] huella = digest.digest(certificado);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < huella.length; i++) {
            if (i > 0) sb.append(":");
            sb.append(String.format("%02X", huella[i]));
        }
        return sb.toString();
    }
}
