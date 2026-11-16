package br.com.eusereibiologo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class StudyAlarmReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  if(!StudyAlarmPlugin.ACTION_FIRE.equals(intent.getAction()))return;
  int base=intent.getIntExtra("base",-1),seq=intent.getIntExtra("seq",0);
  var prefs=context.getSharedPreferences(StudyAlarmPlugin.PREF,Context.MODE_PRIVATE);
  if(base<1||seq<1||seq>4||base!=prefs.getInt("base",-1))return;
  Intent service=new Intent(context,StudyAlarmService.class);
  service.setAction(StudyAlarmService.START).putExtra("base",base).putExtra("seq",seq);
  try{
   if(Build.VERSION.SDK_INT>=26)context.startForegroundService(service);
   else context.startService(service);
  }catch(Exception e){
   // Em restrições de segundo plano o sistema pode impedir o serviço.
   // Ainda mostraremos notificação normal, quando permitido.
   StudyAlarmService.postFallback(context,base,seq,prefs.getString("course","Estudo"));
  }
 }
}
