package br.com.eusereibiologo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import org.json.JSONObject;

/** AlarmManager fires while WebView is closed; schedules the next selected week. */
public class WeeklyStudyAlarmReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent intent){
  if(intent==null||!WeeklyStudyAlarmPlugin.ACTION.equals(intent.getAction()))return;
  int id=intent.getIntExtra("slotId",-1),seq=intent.getIntExtra("seq",0);
  JSONObject slot=WeeklyStudyAlarmPlugin.find(WeeklyStudyAlarmPlugin.read(c),id);
  if(slot==null||!slot.optBoolean("enabled",true)||seq<1||seq>4)return;
  long active=slot.optLong("activeDay");
  if(active>System.currentTimeMillis()+WeeklyStudyAlarmPlugin.STEP*WeeklyStudyAlarmPlugin.MAX)return;
  // Renew before launching UI, even if Android closes the process afterwards.
  if(seq==4)WeeklyStudyAlarmPlugin.acknowledge(c,id);
  if("standard".equals(slot.optString("mode","alarm"))){
   notifyDiscreet(c,id,seq,slot.optString("course","Estudo"));
   return;
  }
  Intent service=new Intent(c,StudyAlarmService.class);
  service.setAction(StudyAlarmService.START).putExtra("weeklySlotId",id)
    .putExtra("base",0).putExtra("seq",seq).putExtra("weeklyCourse",slot.optString("course","Estudo"));
  try{
   if(Build.VERSION.SDK_INT>=26)c.startForegroundService(service);
   else c.startService(service);
  }catch(Exception ignored){
   StudyAlarmService.postWeeklyFallback(c,id,seq,slot.optString("course","Estudo"));
  }
 }
 static void notifyDiscreet(Context c,int id,int seq,String course){
  String channel="study_weekly_discreet_v1";
  NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26){
   NotificationChannel ch=new NotificationChannel(channel,"Lembretes de estudo",NotificationManager.IMPORTANCE_DEFAULT);
   nm.createNotificationChannel(ch);
  }
  Intent open=new Intent(c,StudyAlarmActivity.class).putExtra("base",-id).putExtra("seq",seq);
  PendingIntent pi=PendingIntent.getActivity(c,200000+id*8+seq,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification.Builder n=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,channel):new Notification.Builder(c);
  n.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
   .setContentTitle("🌿 Hora de estudar — "+course)
   .setContentText("Lembrete "+seq+" de 4. Toque para estudar ou adiar.")
   .setContentIntent(pi).setAutoCancel(true)
   .setCategory(Notification.CATEGORY_REMINDER);
  nm.notify(200000+id*8+seq,n.build());
 }

}
