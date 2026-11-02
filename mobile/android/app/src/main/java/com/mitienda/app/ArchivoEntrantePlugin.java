package com.mitienda.app;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

// Recibe los Excel que llegan desde otra app con "Abrir con" o "Compartir"
// (WhatsApp, Archivos, Gmail...) — ver los intent-filter de MainActivity en
// AndroidManifest.xml. El WebView no puede leer un content:// ajeno por su
// cuenta, así que este plugin guarda el archivo pendiente y se lo pasa al
// JavaScript en base64 cuando lo pide (ver src/lib/archivoEntrante.ts).
@CapacitorPlugin(name = "ArchivoEntrante")
public class ArchivoEntrantePlugin extends Plugin {

    private static final int TAMANO_MAXIMO_BYTES = 15 * 1024 * 1024;

    private Uri uriPendiente;

    // Arranque en frío: la app se abrió directamente con el archivo.
    @Override
    public void load() {
        uriPendiente = extraerUri(getActivity().getIntent());
    }

    // La app ya estaba abierta (launchMode singleTask): el archivo llega acá.
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        Uri uri = extraerUri(intent);
        if (uri == null) return;
        uriPendiente = uri;
        notifyListeners("archivoRecibido", new JSObject());
    }

    private Uri extraerUri(Intent intent) {
        if (intent == null) return null;
        // Al reabrir la app desde "recientes" Android vuelve a entregar el
        // intent original: sin esto se reimportaría el mismo archivo.
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return null;

        String accion = intent.getAction();
        if (Intent.ACTION_VIEW.equals(accion)) return intent.getData();
        if (Intent.ACTION_SEND.equals(accion)) return intent.getParcelableExtra(Intent.EXTRA_STREAM);
        return null;
    }

    @PluginMethod
    public void hayPendiente(PluginCall call) {
        JSObject resultado = new JSObject();
        resultado.put("hay", uriPendiente != null);
        call.resolve(resultado);
    }

    // Devuelve el archivo pendiente y lo descarta: se entrega una sola vez.
    @PluginMethod
    public void tomarPendiente(PluginCall call) {
        Uri uri = uriPendiente;
        uriPendiente = null;

        JSObject resultado = new JSObject();
        if (uri == null) {
            call.resolve(resultado);
            return;
        }

        try (InputStream entrada = getContext().getContentResolver().openInputStream(uri)) {
            if (entrada == null) {
                call.reject("No se pudo abrir el archivo");
                return;
            }
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            byte[] bloque = new byte[8192];
            int leidos;
            while ((leidos = entrada.read(bloque)) != -1) {
                salida.write(bloque, 0, leidos);
                if (salida.size() > TAMANO_MAXIMO_BYTES) {
                    call.reject("El archivo es demasiado grande");
                    return;
                }
            }
            resultado.put("nombre", obtenerNombre(uri));
            resultado.put("datosBase64", Base64.encodeToString(salida.toByteArray(), Base64.NO_WRAP));
            call.resolve(resultado);
        } catch (Exception error) {
            call.reject("No se pudo leer el archivo", error);
        }
    }

    private String obtenerNombre(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int columna = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (columna >= 0 && cursor.getString(columna) != null) return cursor.getString(columna);
            }
        } catch (Exception error) {
            // Sin nombre visible: se usa el genérico de abajo.
        }
        String ultimoTramo = uri.getLastPathSegment();
        return ultimoTramo != null ? ultimoTramo : "productos.xlsx";
    }
}
