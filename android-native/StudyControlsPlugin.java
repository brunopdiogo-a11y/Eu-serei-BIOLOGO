package br.com.eusereibiologo.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="StudyControls")
public class StudyControlsPlugin extends Plugin {
    private static StudyControlsPlugin active;
    @Override public void load(){super.load();active=this;}
    @Override protected void handleOnDestroy(){
        if(active==this)active=null;
        super.handleOnDestroy();
    }
    static void sendCommand(String command){
        StudyControlsPlugin plugin=active;
        if(plugin==null)return;
        JSObject payload=new JSObject();
        payload.put("action",command);
        plugin.notifyListeners("mediaAction",payload,true);
    }
    @PluginMethod public void show(PluginCall call){
        Intent intent=new Intent(getContext(),StudyControlsService.class);
        intent.setAction(StudyControlsService.SHOW);
        intent.putExtra("paused",Boolean.TRUE.equals(call.getBoolean("paused",false)));
        intent.putExtra("paragraph",call.getInt("paragraph",1));
        intent.putExtra("total",call.getInt("total",1));
        intent.putExtra("title",call.getString("title","Ecologia Vegetal"));
        try {
            if(Build.VERSION.SDK_INT>=26)getContext().startForegroundService(intent);
            else getContext().startService(intent);
            call.resolve();
        }catch(Exception e){call.reject("Não foi possível mostrar controles de áudio: "+e.getMessage());}
    }
    @PluginMethod public void hide(PluginCall call){
        try {
            getContext().stopService(new Intent(getContext(),StudyControlsService.class));
            call.resolve();
        }catch(Exception e){call.reject(e.getMessage());}
    }
}
