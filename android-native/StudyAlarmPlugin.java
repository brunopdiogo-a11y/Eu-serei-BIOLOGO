package br.com.eusereibiologo.app;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Calendar;

@CapacitorPlugin(name="StudyAlarm")
public class StudyAlarmPlugin extends Plugin {
  static final String PREF="study_alarm_native";
  static final int MAX=4;
  static final String ACTION_FIRE="br.com.eusereibiologo.STUDY_ALARM_FIRE";
  static PendingIntent alarmIntent(Context c,int base,int seq) {
    Intent intent=new Intent(c,StudyAlarmReceiver.class).setAction(ACTION_FIRE);
    intent.putExtra("base",base).putExtra("seq",seq);
    return PendingIntent.getBroadcast(c,seq*200000000+base%100000000,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }
  static void cancel(Context c) {
    var pref=c.getSharedPreferences(PREF,Context.MODE_PRIVATE);
    int base=pref.getInt("base",-1);
    AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
    if(base>0)for(int seq=1;seq<=MAX;seq++)am.cancel(alarmIntent(c,base,seq));
    pref.edit().putInt("base",-1).apply();
    c.stopService(new Intent(c,StudyAlarmService.class));
    ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(StudyAlarmService.NOTIFICATION_ID);
  }
  static long adjustQuiet(long when) {
    Calendar cal=Calendar.getInstance();cal.setTimeInMillis(when);
    int h=cal.get(Calendar.HOUR_OF_DAY);
    if(h>=22){cal.add(Calendar.DAY_OF_MONTH,1);cal.set(Calendar.HOUR_OF_DAY,7);cal.set(Calendar.MINUTE,0);cal.set(Calendar.SECOND,0);}
    else if(h<7){cal.set(Calendar.HOUR_OF_DAY,7);cal.set(Calendar.MINUTE,0);cal.set(Calendar.SECOND,0);}
    return cal.getTimeInMillis();
  }
  static void scheduleAlarm(Context c,int base,int seq,long when) {
    AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
    PendingIntent pi=alarmIntent(c,base,seq);
    if(Build.VERSION.SDK_INT>=31&&!am.canScheduleExactAlarms()){
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
    }else if(Build.VERSION.SDK_INT>=23){
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,pi);
    }else am.setExact(AlarmManager.RTC_WAKEUP,when,pi);
  }
  @PluginMethod public void schedule(PluginCall call) {
    try {
      JSArray times=call.getArray("times");
      int base=call.getInt("base",0);
      int from=call.getInt("fromSeq",1);
      String course=call.getString("course","Ecologia Vegetal");
      if(times==null||times.length()==0||base<=0||from<1||from>4) {call.reject("Compromisso inválido.");return;}
      cancel(getContext());
      var edit=getContext().getSharedPreferences(PREF,Context.MODE_PRIVATE).edit();
      edit.putInt("base",base).putString("course",course).putInt("lastActionSeq",0).apply();
      int count=0;
      for(int i=0;i<times.length();i++) {
        int seq=from+i;
        if(seq>4)break;
        long when=adjustQuiet(times.getLong(i));
        if(when<=System.currentTimeMillis())continue;
        scheduleAlarm(getContext(),base,seq,when);count++;
      }
      JSObject data=new JSObject();data.put("scheduled",count);call.resolve(data);
    }catch(Exception e){call.reject("Falha ao agendar alarme: "+e.getMessage());}
  }
  @PluginMethod public void test(PluginCall call) {
    try{
      Intent intent=new Intent(getContext(),StudyAlarmService.class);
      intent.setAction(StudyAlarmService.START).putExtra("base",0).putExtra("seq",1);
      if(Build.VERSION.SDK_INT>=26)getContext().startForegroundService(intent);
      else getContext().startService(intent);
      call.resolve();
    }catch(Exception e){call.reject("Falha ao testar o alarme: "+e.getMessage());}
  }
  @PluginMethod public void cancel(PluginCall call) {cancel(getContext());call.resolve();}
  @PluginMethod public void status(PluginCall call) {
    var prefs=getContext().getSharedPreferences(PREF,Context.MODE_PRIVATE);
    NotificationManager nm=(NotificationManager)getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    AlarmManager am=(AlarmManager)getContext().getSystemService(Context.ALARM_SERVICE);
    JSObject data=new JSObject();
    data.put("base",prefs.getInt("base",-1));
    data.put("lastActionSeq",prefs.getInt("lastActionSeq",0));
    data.put("lastAction",prefs.getString("lastAction",""));
    data.put("fullScreenAllowed",Build.VERSION.SDK_INT<34||nm.canUseFullScreenIntent());
    data.put("exactAlarmAllowed",Build.VERSION.SDK_INT<31||am.canScheduleExactAlarms());
    call.resolve(data);
  }
  @PluginMethod public void openFullScreenSettings(PluginCall call) {
    try{
      Intent intent;
      if(Build.VERSION.SDK_INT>=34){
        intent=new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,Uri.parse("package:"+getContext().getPackageName()));
      }else{
        intent=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName()));
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);call.resolve();
    }catch(Exception e){call.reject("Não foi possível abrir a permissão: "+e.getMessage());}
  }
}
