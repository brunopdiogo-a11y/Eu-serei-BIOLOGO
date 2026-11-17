package br.com.eusereibiologo.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(name = "StudyDictation")
public class StudyDictationPlugin extends Plugin {
    @PluginMethod
    public void recognize(PluginCall call) {
        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR");
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Fale sua dúvida de Biologia");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            startActivityForResult(call, intent, "onDictationResult");
        } catch (ActivityNotFoundException exception) {
            call.reject("Este Android não tem serviço de reconhecimento de voz. Use o microfone do teclado.");
        } catch (Exception exception) {
            call.reject("Não foi possível abrir o ditado: " + exception.getMessage());
        }
    }

    @ActivityCallback
    private void onDictationResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Ditado cancelado ou não reconhecido.");
            return;
        }
        Intent data=result.getData();
        ArrayList<String> phrases=data == null ? null :
                data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (phrases == null || phrases.isEmpty() || phrases.get(0) == null) {
            call.reject("Nenhuma fala reconhecida.");
            return;
        }
        JSObject payload=new JSObject();
        payload.put("text",phrases.get(0).trim());
        call.resolve(payload);
    }
}
