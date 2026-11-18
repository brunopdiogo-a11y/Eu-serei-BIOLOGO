package br.com.eusereibiologo.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/**
 * Google's AuthorizationClient runs outside Capacitor WebView.
 * Only the short-lived Drive appData token is passed back; never store a client secret.
 */
public class NativeDriveAuthActivity extends Activity {
    private static final int CONSENT_REQUEST = 6501;
    private static final String DRIVE_APPDATA = "https://www.googleapis.com/auth/drive.appdata";
    private boolean awaitingConsent = false;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) {
            // Don't restart an authorization flow on configuration change.
            awaitingConsent = state.getBoolean("awaitingConsent", false);
            if (awaitingConsent) return;
        }
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_APPDATA)))
            .build();
        Identity.getAuthorizationClient(this).authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    try {
                        awaitingConsent = true;
                        startIntentSenderForResult(result.getPendingIntent().getIntentSender(),
                                CONSENT_REQUEST, null, 0, 0, 0);
                    } catch (Exception e) {
                        fail("Não foi possível abrir a autorização Google: " + e.getMessage());
                    }
                } else {
                    succeed(result);
                }
            })
            .addOnFailureListener(error -> fail("Google Play Services: " + error.getMessage()));
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("awaitingConsent", awaitingConsent);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != CONSENT_REQUEST) return;
        awaitingConsent = false;
        if (resultCode != RESULT_OK) {
            fail("Autorização do Google cancelada.");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(this)
                .getAuthorizationResultFromIntent(data);
            succeed(result);
        } catch (Exception e) {
            fail("Não foi possível concluir a autorização Google: " + e.getMessage());
        }
    }

    private void succeed(AuthorizationResult result) {
        String accessToken = result.getAccessToken();
        if (accessToken == null || accessToken.isEmpty() ||
            result.getGrantedScopes() == null ||
            !result.getGrantedScopes().contains(new Scope(DRIVE_APPDATA))) {
            fail("O acesso à pasta privada do Google Drive não foi autorizado.");
            return;
        }
        Intent output = new Intent();
        output.putExtra("accessToken", accessToken);
        setResult(RESULT_OK, output);
        finish();
    }

    private void fail(String message) {
        Intent output = new Intent();
        output.putExtra("error", message);
        setResult(RESULT_CANCELED, output);
        finish();
    }
}
