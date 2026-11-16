package br.com.eusereibiologo.app;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;

public class StudyAlarmService extends Service {
 static final String START="br.com.eusereibiologo.STUDY_ALARM_START";
 static final String STOP="br.com.eusereibiologo.STUDY_ALARM_STOP";
 static final String CHANNEL="study_alarm_ringing_v1";
 static final int NOTIFICATION_ID=89171;
 private MediaPlayer player;
 private Vibrator vibrator;
 private Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable timeout=()->stopSelf();
 private int base=-1,seq=0;
 static void ensureChannel(Context c){
  if(Build.VERSION.SDK_INT<26)return;
  NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
  NotificationChannel channel=new NotificationChannel(CHANNEL,"Alarme de estudo ativo",NotificationManager.IMPORTANCE_HIGH);
  channel.setDescription("Avisa enquanto o alarme de estudo está tocando");
  channel.enableVibration(true);
  // O serviço reproduz o alarme em loop: canal sem som para evitar toque duplo.
  channel.setSound(null,null);
  channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
  nm.createNotificationChannel(channel);
 }
 static Notification build(Context c,int base,int seq,String course){
  ensureChannel(c);
  Intent open=new Intent(c,StudyAlarmActivity.class);
  open.putExtra("base",base).putExtra("seq",seq);
  open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent full=PendingIntent.getActivity(c,base%100000000+seq,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Intent silence=new Intent(c,StudyAlarmService.class).setAction(STOP);
  PendingIntent silenceAction=PendingIntent.getService(c,9901,silence,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Notification.Builder n=Build.VERSION.SDK_INT>=26?
   new Notification.Builder(c,CHANNEL):new Notification.Builder(c);
  n.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
   .setContentTitle("⏰ Hora de estudar — "+course)
   .setContentText("Alarme "+seq+" de 4. Toque para estudar ou adiar.")
   .setContentIntent(full)
   .setPriority(Notification.PRIORITY_MAX)
   .setCategory(Notification.CATEGORY_ALARM)
   .setVisibility(Notification.VISIBILITY_PUBLIC)
   .setAutoCancel(false)
   .setOngoing(true);
  NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
  n.addAction(android.R.drawable.ic_media_pause,"Silenciar",silenceAction);
  if(Build.VERSION.SDK_INT<34||manager.canUseFullScreenIntent())n.setFullScreenIntent(full,true);
  return n.build();
 }
 static void postFallback(Context c,int base,int seq,String course){
  NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
  try{nm.notify(NOTIFICATION_ID,build(c,base,seq,course));}catch(Exception ignored){}
 }
 @Override public IBinder onBind(Intent intent){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent==null)return START_NOT_STICKY;
  if(STOP.equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
  if(!START.equals(intent.getAction()))return START_NOT_STICKY;
  base=intent.getIntExtra("base",-1);seq=intent.getIntExtra("seq",0);
  var prefs=getSharedPreferences(StudyAlarmPlugin.PREF,Context.MODE_PRIVATE);
  if((base!=0)&&(base<1||base!=prefs.getInt("base",-1))) {stopSelf();return START_NOT_STICKY;}
  String course=base==0?"Teste do alarme":prefs.getString("course","Estudo");
  try{
   Notification notification=build(this,base,seq,course);
   if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
   else startForeground(NOTIFICATION_ID,notification);
   playSound();playVibration();
   handler.removeCallbacks(timeout);
   handler.postDelayed(timeout,45000L);
  }catch(Exception ex){stopSelf();}
  return START_NOT_STICKY;
 }
 private void playSound(){
  try{
   if(player!=null){player.stop();player.release();}
   player=new MediaPlayer();
   player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
   android.content.res.AssetFileDescriptor sound=getResources().openRawResourceFd(R.raw.study_alarm);
   player.setDataSource(sound.getFileDescriptor(),sound.getStartOffset(),sound.getLength());
   sound.close();
   player.setLooping(true);
   player.prepare();
   player.start();
  }catch(Exception ignored){}
 }
 private void playVibration(){
  try{
   if(Build.VERSION.SDK_INT>=31)vibrator=((VibratorManager)getSystemService(VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator();
   else vibrator=(Vibrator)getSystemService(VIBRATOR_SERVICE);
   long[] pattern={0,400,250,450,900};
   if(Build.VERSION.SDK_INT>=26)vibrator.vibrate(VibrationEffect.createWaveform(pattern,0));
   else vibrator.vibrate(pattern,0);
  }catch(Exception ignored){}
 }
 @Override public void onDestroy(){
  handler.removeCallbacks(timeout);
  try{if(player!=null){player.stop();player.release();player=null;}}catch(Exception ignored){}
  try{if(vibrator!=null)vibrator.cancel();}catch(Exception ignored){}
  if(Build.VERSION.SDK_INT>=24)stopForeground(STOP_FOREGROUND_REMOVE);
  else stopForeground(true);
  super.onDestroy();
 }
}
