package br.com.eusereibiologo.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import java.security.MessageDigest;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.ConnectionResult;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Bridge for the short-lived OAuth token returned by Google Play Services. */
@CapacitorPlugin(name = "NativeDriveAuth")
public class NativeDriveAuthPlugin extends Plugin {
    /**
     * Public signing certificate fingerprint (not a secret), computed directly
     * from the installed APK. Lets users register the correct OAuth Android
     * client without hunting for GitHub build logs.
     */
    @PluginMethod
    public void diagnostics(PluginCall call) {
        JSObject response = new JSObject();
        response.put("packageName", getContext().getPackageName());
        try {
            PackageManager manager = getContext().getPackageManager();
            PackageInfo info;
            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                info = manager.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                // O OAuth usa o certificado que efetivamente assina o APK instalado.
                signatures = info.signingInfo.getApkContentsSigners();
            } else {
                info = manager.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES);
                signatures = info.signatures;
            }
            if (signatures == null || signatures.length == 0) throw new IllegalStateException("Assinatura não encontrada");
            byte[] digest = MessageDigest.getInstance("SHA-1").digest(signatures[0].toByteArray());
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) {
                if (hex.length() > 0) hex.append(':');
                hex.append(String.format(java.util.Locale.US, "%02X", b & 0xFF));
            }
            response.put("sha1", hex.toString());
            int googleStatus = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext());
            response.put("playServicesStatus", googleStatus);
            response.put("playServicesAvailable", googleStatus == ConnectionResult.SUCCESS);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Não foi possível consultar a assinatura Android: " + error.getMessage());
        }
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeDriveAuthActivity.class);
        // Verificação silenciosa: nunca abrir a tela de consentimento durante a entrada.
        intent.putExtra("silent", call.getBoolean("silent", false));
        startActivityForResult(call, intent, "onAuthorized");
    }

    @ActivityCallback
    private void onAuthorized(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            String error = result.getData() != null
                ? result.getData().getStringExtra("error") : "Autorização Google cancelada.";
            call.reject(error == null ? "Autorização Google cancelada." : error);
            return;
        }
        String accessToken = result.getData().getStringExtra("accessToken");
        if (accessToken == null || accessToken.isEmpty()) {
            call.reject("Google não devolveu um token de acesso.");
            return;
        }
        JSObject response = new JSObject();
        response.put("accessToken", accessToken);
        call.resolve(response);
    }
}
