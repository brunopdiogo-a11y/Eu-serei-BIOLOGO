package br.com.eusereibiologo.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "StudySpeech")
public class StudySpeechPlugin extends Plugin {
    private static StudySpeechPlugin current;
    @Override public void load() {
        super.load();
        current = this;
    }
    @Override protected void handleOnDestroy() {
        if (current == this) current = null;
        super.handleOnDestroy();
    }
    static void emit(String event, int index) {
        StudySpeechPlugin p = current;
        if (p == null) return;
        p.getActivity().runOnUiThread(() -> {
            JSObject data = new JSObject();
            data.put("index", index);
            p.notifyListeners(event, data);
        });
    }
    @PluginMethod public void speak(PluginCall call) {
        String json = call.getString("chunksJson");
        if (json == null || json.isEmpty()) { call.reject("Texto da narração não informado."); return; }
        Intent intent = new Intent(getContext(), StudySpeechService.class);
        intent.setAction(StudySpeechService.ACTION_START);
        intent.putExtra("chunksJson", json);
        intent.putExtra("rate", call.getString("rate", "1.0"));
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            call.resolve();
        } catch (Exception ex) { call.reject("Não foi possível iniciar narração Android: " + ex.getMessage()); }
    }
    private void command(String action, PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), StudySpeechService.class);
            intent.setAction(action);
            getContext().startService(intent);
            call.resolve();
        } catch (Exception ex) { call.reject(ex.getMessage()); }
    }
    @PluginMethod public void pause(PluginCall call) { command(StudySpeechService.ACTION_PAUSE, call); }
    @PluginMethod public void resume(PluginCall call) { command(StudySpeechService.ACTION_RESUME, call); }
    @PluginMethod public void stop(PluginCall call) { command(StudySpeechService.ACTION_STOP, call); }
}
