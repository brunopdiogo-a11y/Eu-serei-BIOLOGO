package br.com.eusereibiologo.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;

public class StudyControlsService extends Service {
    public static final String SHOW="br.com.eusereibiologo.media.SHOW";
    private static final String COMMAND="br.com.eusereibiologo.media.COMMAND.";
    private static final String CHANNEL="study_narration_controls_v1";
    private static final int NOTIFICATION_ID=1867;
    private MediaSession media;
    private boolean paused=false;
    private int paragraph=1,total=1;
    private String title="Ecologia Vegetal";

    @Override public void onCreate(){
        super.onCreate();
        NotificationManager nm=(NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Controles da narração",NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Reproduzir, pausar e avançar a leitura da aula");
            channel.setSound(null,null);
            channel.enableVibration(false);
            nm.createNotificationChannel(channel);
        }
        media=new MediaSession(this,"EuSereiBiologoStudy");
        media.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS|MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        media.setCallback(new MediaSession.Callback(){
            @Override public void onPlay(){StudyControlsPlugin.sendCommand("toggle");}
            @Override public void onPause(){StudyControlsPlugin.sendCommand("toggle");}
            @Override public void onSkipToNext(){StudyControlsPlugin.sendCommand("next");}
            @Override public void onSkipToPrevious(){StudyControlsPlugin.sendCommand("previous");}
            @Override public void onStop(){StudyControlsPlugin.sendCommand("stop");stopSelf();}
        });
        media.setActive(true);
    }
    private PendingIntent action(String command,int number){
        Intent intent=new Intent(this,StudyControlsService.class);
        intent.setAction(COMMAND+command);
        return PendingIntent.getService(this,number,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private void updateMedia(){
        if(media==null)return;
        long controls=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|
            PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_STOP;
        media.setPlaybackState(new PlaybackState.Builder().setActions(controls).setState(
            paused?PlaybackState.STATE_PAUSED:PlaybackState.STATE_PLAYING,PlaybackState.PLAYBACK_POSITION_UNKNOWN,
            paused?0f:1f).build());
        media.setMetadata(new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE,title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST,"EU SEREI BIOLOGO")
            .putString(MediaMetadata.METADATA_KEY_ALBUM,"Parágrafo "+paragraph+" de "+total)
            .build());
    }
    private Notification build(){
        Intent open=new Intent(this,MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap=PendingIntent.getActivity(this,2401,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder n=Build.VERSION.SDK_INT>=26?
            new Notification.Builder(this,CHANNEL):new Notification.Builder(this);
        n.setSmallIcon(android.R.drawable.ic_media_play)
         .setContentTitle("🌿 "+title)
         .setContentText("Parágrafo "+paragraph+" de "+total+(paused?" · Pausado":" · Ouvindo"))
         .setContentIntent(tap)
         .setCategory(Notification.CATEGORY_TRANSPORT)
         .setOngoing(!paused)
         .setOnlyAlertOnce(true)
         .setVisibility(Notification.VISIBILITY_PUBLIC)
         .setPriority(Notification.PRIORITY_LOW);
        n.addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous,"Anterior",action("previous",2411)).build());
        n.addAction(new Notification.Action.Builder(paused?android.R.drawable.ic_media_play:android.R.drawable.ic_media_pause,
            paused?"Continuar":"Pausar",action("toggle",2412)).build());
        n.addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next,"Próximo",action("next",2413)).build());
        n.addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"Parar",action("stop",2414)).build());
        if(Build.VERSION.SDK_INT>=21){
            n.setStyle(new Notification.MediaStyle().setMediaSession(media.getSessionToken()).setShowActionsInCompactView(0,1,2));
        }
        return n.build();
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        String act=intent==null?SHOW:intent.getAction();
        if(act!=null&&act.startsWith(COMMAND)){
            String command=act.substring(COMMAND.length());
            StudyControlsPlugin.sendCommand(command);
            if("stop".equals(command)){stopSelf();return START_NOT_STICKY;}
            return START_NOT_STICKY;
        }
        if(intent!=null){
            paused=intent.getBooleanExtra("paused",false);
            paragraph=Math.max(1,intent.getIntExtra("paragraph",1));
            total=Math.max(paragraph,intent.getIntExtra("total",1));
            title=intent.getStringExtra("title");
            if(title==null||title.isBlank())title="Ecologia Vegetal";
        }
        updateMedia();
        Notification notification=build();
        try{
            if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NOTIFICATION_ID,notification);
        }catch(Exception ex){stopSelf();}
        return START_NOT_STICKY;
    }
    @Override public void onDestroy(){
        if(media!=null){media.setActive(false);media.release();media=null;}
        if(Build.VERSION.SDK_INT>=24)stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent i){return null;}
}
