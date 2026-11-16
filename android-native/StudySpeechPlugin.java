package br.com.eusereibiologo.app;

import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.media.AudioManager;
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
        new Handler(Looper.getMainLooper()).post(() -> {
            JSObject data = new JSObject();
            data.put("index", index);
            p.notifyListeners(event, data);
        });
    }
    @PluginMethod public void testVoice(PluginCall call) {
        Intent intent = new Intent(getContext(), StudySpeechService.class);
        intent.setAction(StudySpeechService.ACTION_START);
        intent.putExtra("chunksJson", "[\"Olá! Este é o teste de voz do aplicativo Eu Serei Biólogo.\"]");
        intent.putExtra("rate","0.9");
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(intent);
            else getContext().startService(intent);
            call.resolve();
        } catch(Exception ex) { call.reject("Falha ao testar voz: "+ex.getMessage()); }
    }
    @PluginMethod public void diagnostic(PluginCall call) {
        JSObject info = new JSObject();
        var prefs = getContext().getSharedPreferences(StudySpeechService.PREF,Context.MODE_PRIVATE);
        info.put("state",prefs.getString("state","not_started"));
        info.put("detail",prefs.getString("detail",""));
        AudioManager audio=(AudioManager)getContext().getSystemService(Context.AUDIO_SERVICE);
        info.put("mediaVolume",audio.getStreamVolume(AudioManager.STREAM_MUSIC));
        info.put("mediaMaxVolume",audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        info.put("engine",prefs.getString("engine",""));
        call.resolve(info);
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
