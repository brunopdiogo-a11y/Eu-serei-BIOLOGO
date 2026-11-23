package br.com.eusereibiologo.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="StudyFloatingText")
public class StudyFloatingTextPlugin extends Plugin {
    private WindowManager manager;
    private LinearLayout overlay;
    private TextView caption;
    private WindowManager.LayoutParams params;

    @PluginMethod public void check(PluginCall call) {
        JSObject result=new JSObject();
        result.put("granted",Build.VERSION.SDK_INT<23||Settings.canDrawOverlays(getContext()));
        call.resolve(result);
    }

    @PluginMethod public void requestPermission(PluginCall call) {
        if(Build.VERSION.SDK_INT>=23&&!Settings.canDrawOverlays(getContext())){
            Intent intent=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:"+getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try{getContext().startActivity(intent);}catch(Exception e){
                call.reject("Não foi possível abrir a permissão: "+e.getMessage());return;
            }
        }
        call.resolve();
    }

    @PluginMethod public void show(PluginCall call) {
        if(Build.VERSION.SDK_INT>=23&&!Settings.canDrawOverlays(getContext())){
            call.reject("Permissão Exibir sobre outros apps não concedida.");return;
        }
        String text=call.getString("text","");
        if(text==null||text.trim().isEmpty()){hideOverlay();call.resolve();return;}
        String shown=text.trim();
        if(shown.length()>320)shown=shown.substring(0,317)+"…";
        final String value=shown;
        getActivity().runOnUiThread(()->{
            try{
                if(overlay==null)createOverlay();
                caption.setText(value);
                overlay.setVisibility(android.view.View.VISIBLE);
                call.resolve();
            }catch(Exception e){call.reject("Janela flutuante indisponível: "+e.getMessage());}
        });
    }

    private GradientDrawable background(int color,int radius){
        GradientDrawable shape=new GradientDrawable();
        shape.setColor(color);shape.setCornerRadius(radius);
        shape.setStroke(dp(1),Color.rgb(91,153,112));
        return shape;
    }
    private int dp(int value){return Math.round(value*getContext().getResources().getDisplayMetrics().density);}

    private void createOverlay(){
        manager=(WindowManager)getContext().getSystemService(Context.WINDOW_SERVICE);
        overlay=new LinearLayout(getContext());
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(dp(14),dp(10),dp(14),dp(12));
        overlay.setBackground(background(Color.rgb(22,45,35),dp(16)));
        TextView heading=new TextView(getContext());
        heading.setText("📖 EU SEREI BIÓLOGO  ·  lendo agora");
        heading.setTextColor(Color.rgb(177,223,187));
        heading.setTextSize(11);
        caption=new TextView(getContext());
        caption.setTextColor(Color.WHITE);caption.setTextSize(16);
        caption.setMaxLines(5);caption.setLineSpacing(dp(3),1f);
        LinearLayout.LayoutParams space=new LinearLayout.LayoutParams(-1,-2);
        space.topMargin=dp(7);
        overlay.addView(heading);
        overlay.addView(caption,space);
        params=new WindowManager.LayoutParams(
                Math.min(dp(345),getContext().getResources().getDisplayMetrics().widthPixels-dp(24)),
                -2,
                Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.TOP|Gravity.CENTER_HORIZONTAL;
        params.y=dp(100);
        manager.addView(overlay,params);
        // Toque na faixa superior permite arrastar a janela sem atrapalhar outros aplicativos.
        heading.setOnTouchListener(new android.view.View.OnTouchListener(){
            private float startY;private int initialY;
            @Override public boolean onTouch(android.view.View view,android.view.MotionEvent event){
                if(event.getAction()==android.view.MotionEvent.ACTION_DOWN){
                    startY=event.getRawY();initialY=params.y;return true;
                }
                if(event.getAction()==android.view.MotionEvent.ACTION_MOVE){
                    params.y=Math.max(0,initialY+Math.round(event.getRawY()-startY));
                    try{manager.updateViewLayout(overlay,params);}catch(Exception ignored){}
                    return true;
                }
                return event.getAction()==android.view.MotionEvent.ACTION_UP;
            }
        });
    }

    private void hideOverlay(){
        if(overlay!=null){
            try{manager.removeView(overlay);}catch(Exception ignored){}
            overlay=null;caption=null;manager=null;params=null;
        }
    }
    @PluginMethod public void hide(PluginCall call){
        new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{hideOverlay();call.resolve();});
    }
    @Override protected void handleOnDestroy(){hideOverlay();super.handleOnDestroy();}
}
