package br.com.eusereibiologo.app;

import android.app.Service;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.Context;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.speech.tts.UtteranceProgressListener;
import java.util.ArrayList;
import java.util.Locale;
import org.json.JSONArray;

public class StudySpeechService extends Service implements TextToSpeech.OnInitListener {
    public static final String ACTION_START = "br.com.eusereibiologo.action.SPEAK";
    public static final String ACTION_PAUSE = "br.com.eusereibiologo.action.PAUSE";
    public static final String ACTION_RESUME = "br.com.eusereibiologo.action.RESUME";
    public static final String ACTION_STOP = "br.com.eusereibiologo.action.STOP";
    private static final String CHANNEL = "study_speech_audio";
    public static final String PREF = "study_speech_diagnostic_v1";
    private void updateDiagnostic(String state,String detail){
        getSharedPreferences(PREF,MODE_PRIVATE).edit().putString("state",state).putString("detail",detail).apply();
    }
    private static final int NOTIFICATION_ID = 1609;
    private final ArrayList<String> chunks = new ArrayList<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextToSpeech tts;
    private boolean ready = false, started = false, paused = false;
    private int index = 0;
    private float rate = 0.9f;
    private PowerManager.WakeLock wakeLock;

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Narração das aulas", NotificationManager.IMPORTANCE_LOW));
        }
        updateDiagnostic("initializing","Iniciando mecanismo de fala do Android");
        tts = new TextToSpeech(this, this);
        PowerManager pm=(PowerManager)getSystemService(Context.POWER_SERVICE);
        wakeLock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"EuSereiBiologo:AudioAula");
        wakeLock.setReferenceCounted(false);
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    private PendingIntent serviceAction(String action, int request) {
        Intent intent=new Intent(this, StudySpeechService.class);
        intent.setAction(action);
        return PendingIntent.getService(this, request, intent, PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification notification() {
        Intent open=new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap=PendingIntent.getActivity(this,9,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT>=26
            ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        builder.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("EU SEREI BIOLOGO · Narração")
            .setContentText(paused?"Leitura pausada":"Ouvindo Ecologia Vegetal")
            .setContentIntent(tap)
            .setOnlyAlertOnce(true)
            .setOngoing(!paused)
            .setVisibility(Notification.VISIBILITY_PUBLIC);
        if(paused)builder.addAction(android.R.drawable.ic_media_play,"Continuar",serviceAction(ACTION_RESUME,11));
        else builder.addAction(android.R.drawable.ic_media_pause,"Pausar",serviceAction(ACTION_PAUSE,12));
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel,"Parar",serviceAction(ACTION_STOP,13));
        return builder.build();
    }
    private void showForeground(){
        if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,notification(),ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIFICATION_ID,notification());
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action=intent==null?null:intent.getAction();
        if(ACTION_START.equals(action)){
            chunks.clear();
            try {
                JSONArray values=new JSONArray(intent.getStringExtra("chunksJson"));
                for(int i=0;i<values.length();i++){
                    String line=values.optString(i,"").trim();
                    if(!line.isEmpty())chunks.add(line);
                }
            }catch(Exception ignored){}
            try{rate=Math.max(.7f,Math.min(1.5f,Float.parseFloat(intent.getStringExtra("rate"))));}catch(Exception ignored){rate=.9f;}
            index=0;paused=false;started=!chunks.isEmpty();
            if(!started){updateDiagnostic("error","Nenhuma frase de leitura recebida");stopSelf();return START_NOT_STICKY;}
            updateDiagnostic("starting", "Aguardando mecanismo de voz");
            showForeground();
            if(wakeLock!=null&&!wakeLock.isHeld())wakeLock.acquire(2*60*60*1000L);
            if(ready)speakNext();
        }else if(ACTION_PAUSE.equals(action)){
            paused=true;
            StudySpeechPlugin.emit("paused",index);
            if(tts!=null)tts.stop();
            if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();
            if(started)showForeground();
        }else if(ACTION_RESUME.equals(action)){
            if(started){
                paused=false;
                StudySpeechPlugin.emit("resumed",index);
                if(wakeLock!=null&&!wakeLock.isHeld())wakeLock.acquire(2*60*60*1000L);
                showForeground();
                if(ready)speakNext();
            }
        }else if(ACTION_STOP.equals(action)){
            stopReading();
        }
        return START_NOT_STICKY;
    }
    @Override public void onInit(int status) {
        if(status!=TextToSpeech.SUCCESS){updateDiagnostic("error","Motor de voz não inicializou (código "+status+")");StudySpeechPlugin.emit("error",-1);stopReading();return;}
        ready=true;
        if(tts==null){updateDiagnostic("error","Motor TTS indisponível");StudySpeechPlugin.emit("error",-1);stopReading();return;}
        String engine=tts.getDefaultEngine();
        getSharedPreferences(PREF,MODE_PRIVATE).edit().putString("engine",engine==null?"":engine).apply();
        tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        int language=tts.setLanguage(new Locale("pt","BR"));
        if(language==TextToSpeech.LANG_MISSING_DATA||language==TextToSpeech.LANG_NOT_SUPPORTED){
            updateDiagnostic("error","Voz pt-BR ausente ou não compatível com o mecanismo de fala");
            StudySpeechPlugin.emit("error",-1);stopReading();return;
        }
        updateDiagnostic("ready","Voz pt-BR disponível");
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
            @Override public void onStart(String id) {
                int k=parseIndex(id);
                handler.post(()->{updateDiagnostic("speaking","Áudio iniciado, trecho "+(k+1));StudySpeechPlugin.emit("progress",k);});
            }
            @Override public void onDone(String id){
                int k=parseIndex(id);
                handler.post(()->{
                    if(started&&!paused&&k==index){index++;speakNext();}
                });
            }
            @Override public void onError(String id){
                handler.post(()->{updateDiagnostic("error","O mecanismo falhou durante a reprodução");StudySpeechPlugin.emit("error",index);stopReading();});
            }
        });
        if(started&&!paused)speakNext();
    }
    private int parseIndex(String id){
        try{return Integer.parseInt(id.substring(8));}catch(Exception e){return index;}
    }
    private void speakNext(){
        if(!started||paused||!ready)return;
        if(index>=chunks.size()){
            updateDiagnostic("finished","Narração concluída");
            StudySpeechPlugin.emit("finished",index);
            stopReading();return;
        }
        tts.setSpeechRate(rate);
        int result=tts.speak(chunks.get(index),TextToSpeech.QUEUE_FLUSH,null,"segment-"+index);
        if(result==TextToSpeech.ERROR){
            updateDiagnostic("error","Motor TTS recusou a frase de leitura");
            StudySpeechPlugin.emit("error",index);
            stopReading();
        }
    }
    private void stopReading(){
        started=false;paused=false;
        if(tts!=null)tts.stop();
        if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();
        if(Build.VERSION.SDK_INT>=24)stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        stopSelf();
    }
    @Override public void onDestroy(){
        if(tts!=null){tts.stop();tts.shutdown();tts=null;}
        if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();
        super.onDestroy();
    }
}
