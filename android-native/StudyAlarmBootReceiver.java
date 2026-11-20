package br.com.eusereibiologo.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Rebuild locally scheduled recurring study alarms after Android restarts. */
public class StudyAlarmBootReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context,Intent intent){
    String action=intent==null?"":intent.getAction();
    if(Intent.ACTION_BOOT_COMPLETED.equals(action)||
       Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)){
      try{StudyAlarmPlugin.restoreDailyAfterBoot(context);}
      catch(Exception ignored){}
    }
  }
}
