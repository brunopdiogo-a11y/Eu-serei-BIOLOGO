package br.com.eusereibiologo.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Calendar;

/**
 * Independent, persisted weekly study timetable. Each slot has its own Android
 * alarms and therefore does not replace or cancel another study slot.
 * Sunday=0 ... Saturday=6. One occurrence is armed at a time (4 alarms).
 */
@CapacitorPlugin(name="WeeklyStudyAlarm")
public class WeeklyStudyAlarmPlugin extends Plugin {
 static final String PREF="study_weekly_v1", DATA="slots";
 static final int MAX=4, STEP=15*60*1000;
 static final String ACTION="br.com.eusereibiologo.STUDY_WEEKLY_FIRE";
 static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE);}
 static synchronized JSONArray read(Context c) {
  try{return new JSONArray(prefs(c).getString(DATA,"[]"));}catch(Exception e){return new JSONArray();}
 }
 static synchronized void persist(Context c,JSONArray arr){prefs(c).edit().putString(DATA,arr.toString()).commit();}
 static JSONObject find(JSONArray all,int id){
  for(int i=0;i<all.length();i++){JSONObject obj=all.optJSONObject(i);if(obj!=null&&obj.optInt("id")==id)return obj;}return null;
 }
 static PendingIntent pending(Context c,int id,int seq){
  Intent intent=new Intent(c,WeeklyStudyAlarmReceiver.class).setAction(ACTION)
    .putExtra("slotId",id).putExtra("seq",seq);
  return PendingIntent.getBroadcast(c,id*8+seq,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
 }
 static void cancelPending(Context c,int id){
  AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
  for(int i=1;i<=MAX;i++)am.cancel(pending(c,id,i));
 }
 static void arm(Context c,int id,int seq,long at){
  AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
  PendingIntent pi=pending(c,id,seq);
  if(Build.VERSION.SDK_INT>=31&&!am.canScheduleExactAlarms())am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);
  else if(Build.VERSION.SDK_INT>=23)am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);
  else am.setExact(AlarmManager.RTC_WAKEUP,at,pi);
 }
 static boolean selected(JSONObject slot,int day){return (slot.optInt("days")&(1<<day))!=0;}
 static long nextOccurrence(JSONObject slot,long after){
  int h=slot.optInt("hour"),m=slot.optInt("minute");
  Calendar c=Calendar.getInstance();
  c.setTimeInMillis(after);
  c.set(Calendar.SECOND,0);c.set(Calendar.MILLISECOND,0);
  for(int d=0;d<15;d++){
   Calendar next=(Calendar)c.clone();
   next.add(Calendar.DAY_OF_YEAR,d);next.set(Calendar.HOUR_OF_DAY,h);next.set(Calendar.MINUTE,m);
   long when=next.getTimeInMillis();
   if(selected(slot,next.get(Calendar.DAY_OF_WEEK)-1)&&when>after)return when;
  }
  return 0;
 }
 static void scheduleFour(Context c,JSONObject slot,long first){
  int id=slot.optInt("id");cancelPending(c,id);
  for(int seq=1;seq<=MAX;seq++){
   long when=StudyAlarmPlugin.adjustQuiet(first+(seq-1)*STEP);
   arm(c,id,seq,when);
  }
 }
 static synchronized void setNext(Context c,int id,long after) {
  JSONArray all=read(c);
  JSONObject slot=find(all,id);
  if(slot==null)return;
  long first=nextOccurrence(slot,after);
  if(first<=0)return;
  try{slot.put("nextAt",first);slot.put("activeDay",first);}catch(Exception e){return;}
  persist(c,all);
  scheduleFour(c,slot,first);
 }
 static synchronized void finishCurrent(Context c,int id){
  JSONArray all=read(c);
  JSONObject slot=find(all,id);if(slot==null)return;
  // Avoid duplicate rollover if the fourth alarm already scheduled next week.
  long currently=slot.optLong("activeDay");
  long now=System.currentTimeMillis();
  if(currently>now+STEP*MAX)return;
  long next=nextOccurrence(slot,Math.max(currently,now)+STEP*MAX);
  if(next<=0)return;
  try{slot.put("nextAt",next);slot.put("activeDay",next);}catch(Exception e){return;}
  persist(c,all);
  scheduleFour(c,slot,next);
 }
 static synchronized void acknowledge(Context c,int id){
  JSONArray all=read(c);JSONObject slot=find(all,id);if(slot==null)return;
  // If current schedule is already in the future, today is already finished.
  long active=slot.optLong("activeDay");
  if(active>System.currentTimeMillis()+STEP*MAX)return;
  long next=nextOccurrence(slot,Math.max(System.currentTimeMillis(),active)+STEP*MAX);
  if(next<=0)return;
  try{slot.put("nextAt",next);slot.put("activeDay",next);}catch(Exception e){return;}
  persist(c,all);scheduleFour(c,slot,next);
 }
 static synchronized void snooze(Context c,int id,int seq){
  JSONArray all=read(c);JSONObject slot=find(all,id);if(slot==null)return;
  long active=slot.optLong("activeDay");
  // Fourth alarm may already have rolled to next week; do not erase it.
  if(active>System.currentTimeMillis()+STEP*MAX)return;
  if(seq>=MAX){acknowledge(c,id);return;}
  cancelPending(c,id);
  long now=System.currentTimeMillis()+STEP;
  for(int n=seq+1;n<=MAX;n++){
   arm(c,id,n,StudyAlarmPlugin.adjustQuiet(now+(n-seq-1)*STEP));
  }
 }
 static synchronized void restore(Context c){
  JSONArray all=read(c);
  for(int i=0;i<all.length();i++){
   JSONObject slot=all.optJSONObject(i);if(slot==null)continue;
   int id=slot.optInt("id");
   if(id<1||!slot.optBoolean("enabled",true))continue;
   long next=nextOccurrence(slot,System.currentTimeMillis()+1000);
   if(next<=0)continue;
   try{slot.put("nextAt",next);slot.put("activeDay",next);}catch(Exception ignored){}
   scheduleFour(c,slot,next);
  }
  persist(c,all);
 }
 @PluginMethod public void list(PluginCall call){
  JSObject out=new JSObject();out.put("items",read(getContext()));call.resolve(out);
 }
 @PluginMethod public void save(PluginCall call){
  try{
   int id=call.getInt("id",0),days=call.getInt("days",0);
   int hour=call.getInt("hour",-1),minute=call.getInt("minute",-1);
   String course=call.getString("course","Ecologia Vegetal");
   String mode=call.getString("mode","alarm");
   if(!"alarm".equals(mode)&&!"standard".equals(mode)){call.reject("Tipo de aviso inválido.");return;}
   if(days<1||days>127||hour<7||hour>21||minute<0||minute>59||course.length()>90){call.reject("Confira os dias, horário (7h–21h59) e disciplina.");return;}
   JSONArray arr=read(getContext());
   if(id<1){
    if(arr.length()>=30){call.reject("Limite de 30 horários. Exclua um para continuar.");return;}
    id=prefs(getContext()).getInt("nextId",100)+1;
    prefs(getContext()).edit().putInt("nextId",id).apply();
   }
   JSONObject slot=find(arr,id);
   if(slot==null){slot=new JSONObject();arr.put(slot);}
   else cancelPending(getContext(),id);
   slot.put("id",id);slot.put("days",days);slot.put("hour",hour);slot.put("minute",minute);
   slot.put("course",course);slot.put("mode",mode);slot.put("enabled",true);
   long first=nextOccurrence(slot,System.currentTimeMillis()+1000);
   if(first<=0){call.reject("Nenhuma ocorrência futura encontrada.");return;}
   slot.put("nextAt",first);slot.put("activeDay",first);
   persist(getContext(),arr);
   scheduleFour(getContext(),slot,first);
   JSObject out=new JSObject();out.put("items",arr);call.resolve(out);
  }catch(Exception e){call.reject("Falha ao salvar horário semanal: "+e.getMessage());}
 }
 @PluginMethod public void remove(PluginCall call){
  int id=call.getInt("id",0);
  JSONArray arr=read(getContext()),out=new JSONArray();
  for(int i=0;i<arr.length();i++){
   JSONObject slot=arr.optJSONObject(i);
   if(slot!=null&&slot.optInt("id")!=id)out.put(slot);
  }
  cancelPending(getContext(),id);
  persist(getContext(),out);
  JSObject result=new JSObject();result.put("items",out);call.resolve(result);
 }
 @PluginMethod public void setAllEnabled(PluginCall call){
  boolean enabled=call.getBoolean("enabled",true);
  JSONArray all=read(getContext());
  for(int i=0;i<all.length();i++){
   JSONObject slot=all.optJSONObject(i);if(slot==null)continue;
   int id=slot.optInt("id");
   cancelPending(getContext(),id);
   try{slot.put("enabled",enabled);}catch(Exception ignored){}
   if(enabled){
    long first=nextOccurrence(slot,System.currentTimeMillis()+1000);
    try{slot.put("nextAt",first);slot.put("activeDay",first);}catch(Exception ignored){}
    if(first>0)scheduleFour(getContext(),slot,first);
   }
  }
  persist(getContext(),all);
  JSObject out=new JSObject();out.put("items",all);call.resolve(out);
 }
 @PluginMethod public void finish(PluginCall call){
  int id=call.getInt("id",0);
  if(find(read(getContext()),id)==null){call.reject("Horário não encontrado.");return;}
  acknowledge(getContext(),id);
  JSObject result=new JSObject();result.put("items",read(getContext()));call.resolve(result);
 }
}
