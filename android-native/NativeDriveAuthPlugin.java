package br.com.eusereibiologo.app;

import android.app.Activity;
import android.content.Intent;
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
    @PluginMethod
    public void authorize(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeDriveAuthActivity.class);
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
