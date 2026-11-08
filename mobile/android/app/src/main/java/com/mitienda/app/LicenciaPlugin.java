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

    // Huella SHA-256 (formato de "keytool -list -v") del certificado con el
    // que debe estar firmado este APK. La de acá es la del keystore de
    // DEPURACIÓN de esta máquina — sirve solo para probar. Antes de entregar
    // un APK firmado de verdad a un cliente hay que reemplazarla por la
    // huella del keystore real. No es un secreto: es pública por naturaleza.
    private static final String HUELLA_FIRMA_ESPERADA =
        "1D:AB:B3:33:96:28:3A:1C:1F:93:F8:8B:7C:6A:01:E5:97:C0:CB:BE:E6:D2:2B:78:2B:2F:3D:02:FD:77:55:25";

    @PluginMethod
    public void verificarFirma(PluginCall call) {
        boolean valida;
        try {
            String huellaActual = obtenerHuellaFirmaActual();
            valida = huellaActual != null && huellaActual.equalsIgnoreCase(HUELLA_FIRMA_ESPERADA);
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
