package br.com.eusereibiologo.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "AppHealth")
public class AppHealthPlugin extends Plugin {
    @PluginMethod public void inspect(PluginCall call) {
        try {
            PowerManager power=(PowerManager)getContext().getSystemService(Context.POWER_SERVICE);
            NotificationManager notifications=(NotificationManager)getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            JSObject result=new JSObject();
            result.put("batteryOptimizationExempt", Build.VERSION.SDK_INT<23 || power.isIgnoringBatteryOptimizations(getContext().getPackageName()));
            result.put("batterySaverOn", Build.VERSION.SDK_INT>=21 && power.isPowerSaveMode());
            result.put("notificationsEnabled", Build.VERSION.SDK_INT<24 || notifications.areNotificationsEnabled());
            result.put("sdkInt", Build.VERSION.SDK_INT);
            call.resolve(result);
        } catch(Exception ex) { call.reject("Diagnóstico Android indisponível: "+ex.getMessage()); }
    }
    @PluginMethod public void openBatterySettings(PluginCall call) {
        try {
            Intent intent=new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch(Exception ex) { openAppSettings(call); }
    }
    @PluginMethod public void openAppSettings(PluginCall call) {
        try {
            Intent intent=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:"+getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch(Exception ex) { call.reject("Não foi possível abrir as configurações: "+ex.getMessage()); }
    }
}
