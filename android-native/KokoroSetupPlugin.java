package br.com.eusereibiologo.app;

import android.content.Intent;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Kokoro Dora can run offline through the Marmalade Android TTS engine.
 * The user downloads the Kokoro model and selects pf_dora in Marmalade.
 * This bridge only reports the default engine and opens Android settings;
 * it never pretends to bundle/download neural model weights.
 */
@CapacitorPlugin(name = "KokoroSetup")
public class KokoroSetupPlugin extends Plugin {
    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        String engine = Settings.Secure.getString(
            getContext().getContentResolver(), "tts_default_synth");
        result.put("defaultEngine", engine == null ? "" : engine);
        result.put("marmaladeActive", "app.marmalade.tts".equals(engine));
        result.put("voice", "pf_dora");
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent("com.android.settings.TTS_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            try {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                call.resolve();
            } catch (Exception other) {
                call.reject("Não foi possível abrir os ajustes de voz do Android.", other);
            }
        }
    }
}
