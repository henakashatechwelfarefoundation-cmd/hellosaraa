package com.emergent.completepromptpdf.jvd1n5

import android.app.Activity
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView

/**
 * Always-on-top mic bubble that survives across other apps
 * (requires SYSTEM_ALERT_WINDOW granted at runtime).
 *
 * The user grants permission from Settings ▸ Display over other apps.
 * When tapped, this fires an intent back into the app deep-link
 * `frontend://chat?autostart=1` so the assistant opens and starts listening.
 */
class OverlayActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Settings.canDrawOverlays(this)) {
            val i = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            startActivityForResult(i, 1)
            return
        }
        showBubble()
        finish()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 1 && Settings.canDrawOverlays(this)) {
            showBubble()
        }
        finish()
    }

    private fun showBubble() {
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else
            @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        )
        params.gravity = Gravity.END or Gravity.BOTTOM
        params.x = 24
        params.y = 240

        val bubble = FrameLayout(this).apply {
            val iv = ImageView(this@OverlayActivity).apply {
                setImageResource(android.R.drawable.ic_btn_speak_now)
                setBackgroundResource(android.R.drawable.presence_online)
                setPadding(32, 32, 32, 32)
                setOnClickListener {
                    val i = Intent(Intent.ACTION_VIEW, Uri.parse("frontend://chat?autostart=1"))
                    i.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    context.startActivity(i)
                }
            }
            addView(iv)
        }

        try { wm.addView(bubble, params) } catch (_: Exception) {}
    }
}
