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

// Plugin nativo de licencia: el JavaScript de la app (que queda empaquetado
// como texto plano dentro del APK, legible con cualquier descompresor) nunca
// conoce la palabra secreta ni la clave correcta — solo le manda el código de
// dispositivo y lo que el usuario escribió, y este plugin le contesta
// verdadero/falso. Ver licencias/LEEME-SEGURIDAD.txt para el detalle de qué
// se protegió acá y cómo mantenerlo.
@CapacitorPlugin(name = "LicenciaNativa")
public class LicenciaPlugin extends Plugin {

    // ========================================================================
    // ⚠️ PALABRA SECRETA DE ACTIVACIÓN ⚠️
    // No está escrita completa en ningún lado de este archivo: son 4
    // fragmentos con XOR aplicado, y solo reconstruirPalabraSecreta() los
    // vuelve a unir, en memoria, en el momento de validar una clave.
    //
    // Tiene que reconstruir EXACTAMENTE el mismo texto que la constante
    // PALABRA_SECRETA de licencias/generador-de-claves.html (ahí sí en texto
    // plano — ese archivo nunca se empaqueta en el APK ni se sube a git).
    //
    // Para cambiarla: ver las instrucciones en licencias/LEEME-SEGURIDAD.txt.
    private static final int MASCARA_XOR = 0x5A;
    private static final int[] FRAGMENTO_1 = xorDeTexto("MIP-2026-", MASCARA_XOR);
    private static final int[] FRAGMENTO_2 = xorDeTexto("LLAVE-SEC", MASCARA_XOR);
    private static final int[] FRAGMENTO_3 = xorDeTexto("RETA-DE-A", MASCARA_XOR);
    private static final int[] FRAGMENTO_4 = xorDeTexto("CTIVACION", MASCARA_XOR);

    private static int[] xorDeTexto(String texto, int mascara) {
        int[] resultado = new int[texto.length()];
        for (int i = 0; i < texto.length(); i++) {
            resultado[i] = texto.charAt(i) ^ mascara;
        }
        return resultado;
    }

    private static String textoDeXor(int[] datos, int mascara) {
        StringBuilder sb = new StringBuilder();
        for (int valor : datos) {
            sb.append((char) (valor ^ mascara));
        }
        return sb.toString();
    }

    private static String reconstruirPalabraSecreta() {
        return (
            textoDeXor(FRAGMENTO_1, MASCARA_XOR) +
            textoDeXor(FRAGMENTO_2, MASCARA_XOR) +
            textoDeXor(FRAGMENTO_3, MASCARA_XOR) +
            textoDeXor(FRAGMENTO_4, MASCARA_XOR)
        );
    }
    // ========================================================================

    // Huella SHA-256 (formato de "keytool -list -v") del certificado con el
    // que debe estar firmado este APK. La de acá es la del keystore de
    // DEPURACIÓN de esta máquina — sirve solo para probar. Antes de entregar
    // un APK firmado de verdad a un cliente hay que reemplazarla por la
    // huella del keystore real. Ver licencias/LEEME-SEGURIDAD.txt.
    private static final String HUELLA_FIRMA_ESPERADA =
        "1D:AB:B3:33:96:28:3A:1C:1F:93:F8:8B:7C:6A:01:E5:97:C0:CB:BE:E6:D2:2B:78:2B:2F:3D:02:FD:77:55:25";

    @PluginMethod
    public void validarClave(PluginCall call) {
        String codigoDispositivo = call.getString("codigoDispositivo", "");
        String claveIngresada = call.getString("clave", "");
        boolean valida;
        try {
            String esperada = calcularClaveActivacion(codigoDispositivo);
            String normalizada = claveIngresada.trim().toUpperCase().replaceAll("\\s+", "");
            valida = !esperada.isEmpty() && esperada.equals(normalizada);
        } catch (Exception error) {
            valida = false;
        }
        JSObject resultado = new JSObject();
        resultado.put("valida", valida);
        call.resolve(resultado);
    }

    // Misma fórmula, a mano, en licencias/generador-de-claves.html: código de
    // dispositivo + palabra secreta, SHA-256, primeros 16 caracteres en
    // mayúsculas, agrupados de a 4 separados por guiones.
    private String calcularClaveActivacion(String codigoDispositivo) throws Exception {
        if (codigoDispositivo == null || codigoDispositivo.isEmpty()) return "";
        String textoBase = codigoDispositivo + reconstruirPalabraSecreta();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(textoBase.getBytes("UTF-8"));

        StringBuilder hex = new StringBuilder();
        for (byte b : hash) {
            hex.append(String.format("%02X", b));
        }
        String primeros16 = hex.substring(0, 16);

        StringBuilder agrupado = new StringBuilder();
        for (int i = 0; i < primeros16.length(); i += 4) {
            if (i > 0) agrupado.append("-");
            agrupado.append(primeros16, i, Math.min(i + 4, primeros16.length()));
        }
        return agrupado.toString();
    }

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
