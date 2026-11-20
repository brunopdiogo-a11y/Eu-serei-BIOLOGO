package br.com.eusereibiologo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONObject;

/** AlarmManager fires while WebView is closed; schedules the next selected week. */
public class WeeklyStudyAlarmReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent intent){
  if(intent==null||!WeeklyStudyAlarmPlugin.ACTION.equals(intent.getAction()))return;
  int id=intent.getIntExtra("slotId",-1),seq=intent.getIntExtra("seq",0);
  JSONObject slot=WeeklyStudyAlarmPlugin.find(WeeklyStudyAlarmPlugin.read(c),id);
  if(slot==null||seq<1||seq>4)return;
  long active=slot.optLong("activeDay");
  if(active>System.currentTimeMillis()+WeeklyStudyAlarmPlugin.STEP*WeeklyStudyAlarmPlugin.MAX)return;
  // Renew before launching UI, even if Android closes the process afterwards.
  if(seq==4)WeeklyStudyAlarmPlugin.acknowledge(c,id);
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
}
