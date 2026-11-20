package br.com.eusereibiologo.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class StudyAlarmActivity extends Activity {
 private int base=-1,seq=0;
 private String course="Ecologia Vegetal";
 private void line(LinearLayout root,String value,int sp,boolean bold){
  TextView text=new TextView(this);text.setText(value);text.setTextSize(sp);text.setTextColor(Color.rgb(36,73,51));
  text.setGravity(Gravity.CENTER);text.setPadding(6,14,6,14);
  if(bold)text.setTypeface(Typeface.DEFAULT,Typeface.BOLD);
  root.addView(text,new LinearLayout.LayoutParams(-1,-2));
 }
 private Button action(String title,LinearLayout root,boolean primary,Runnable f){
  Button b=new Button(this);
  b.setText(title);b.setTextSize(16);b.setAllCaps(false);
  b.setTextColor(primary?Color.WHITE:Color.rgb(30,99,58));
  b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(primary?Color.rgb(34,120,70):Color.rgb(233,243,234)));
  LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,58);p.setMargins(0,9,0,9);
  root.addView(b,p);b.setOnClickListener(v->f.run());return b;
 }
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  if(Build.VERSION.SDK_INT>=27){setShowWhenLocked(true);setTurnScreenOn(true);}
  else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED|WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
  base=getIntent().getIntExtra("base",-1);
  seq=getIntent().getIntExtra("seq",0);
  var prefs=getSharedPreferences(StudyAlarmPlugin.PREF,MODE_PRIVATE);
  if(base!=0&&base!=prefs.getInt("base",-1)){finish();return;}
  course=base==0?"Teste do alarme":prefs.getString("course","Estudo");
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  root.setPadding(28,40,28,28);root.setGravity(Gravity.CENTER);root.setBackgroundColor(Color.rgb(247,251,247));
  line(root,"🌿  EU SEREI BIOLOGO",18,true);
  line(root,"⏰",68,false);
  line(root,"Hora de estudar!",28,true);
  line(root,course+" · Aviso "+seq+" de 4",16,false);
  line(root,"Sua meta está esperando. Você pode começar agora ou adiar sem perder o planejamento.",14,false);
  action("▶ Estudar agora",root,true,()->{
   stopAudio();if(base!=0){if(!StudyAlarmPlugin.scheduleNextDay(this))StudyAlarmPlugin.cancel(this);}
   getSharedPreferences(StudyAlarmPlugin.PREF,MODE_PRIVATE).edit().putString("lastAction","study").putInt("lastActionSeq",seq).apply();
   Intent open=new Intent(this,MainActivity.class);
   open.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_NEW_TASK);
   startActivity(open);finish();
  });
  action("⏰ Adiar 15 minutos",root,false,()->{
   stopAudio();
   if(base!=0)snooze();
   finish();
  });
  action("Silenciar este aviso",root,false,()->{
   stopAudio();
   prefs.edit().putString("lastAction","silenced").putInt("lastActionSeq",seq).apply();
   finish();
  });
  setContentView(root);
 }
 private void stopAudio(){
  Intent intent=new Intent(this,StudyAlarmService.class);intent.setAction(StudyAlarmService.STOP);
  try{startService(intent);}catch(Exception ignored){}
 }
 private void snooze(){
  var prefs=getSharedPreferences(StudyAlarmPlugin.PREF,Context.MODE_PRIVATE);
  int newSeq=seq+1;
  for(int i=1;i<=4;i++){
   int original=prefs.getInt("base",-1);
   if(original>0){
    var alarm=(android.app.AlarmManager)getSystemService(ALARM_SERVICE);
    alarm.cancel(StudyAlarmPlugin.alarmIntent(this,original,i));
   }
  }
  if(newSeq>4){
   if(!StudyAlarmPlugin.scheduleNextDay(this)){
    prefs.edit().putInt("base",-1).putString("lastAction","limit").putInt("lastActionSeq",seq).apply();
   }
   return;
  }
  long start=System.currentTimeMillis()+15*60*1000L;
  for(int i=newSeq;i<=4;i++){
   start=StudyAlarmPlugin.adjustQuiet(start);
   StudyAlarmPlugin.scheduleAlarm(this,base,i,start);
   start+=15*60*1000L;
  }
  prefs.edit().putString("lastAction","snoozed").putInt("lastActionSeq",seq).apply();
 }
}
