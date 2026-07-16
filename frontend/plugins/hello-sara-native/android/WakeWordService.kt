package com.emergent.completepromptpdf.jvd1n5

import ai.picovoice.porcupine.Porcupine
import ai.picovoice.porcupine.PorcupineManager
import ai.picovoice.porcupine.PorcupineManagerCallback
import android.app.*
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the microphone hot for wake-word detection
 * ("Hey Sara") using Picovoice Porcupine.
 *
 * Requires two things the app owner supplies (never bundled in this repo):
 *   1. PICOVOICE_ACCESS_KEY — a free key from https://console.picovoice.ai,
 *      injected into AndroidManifest.xml's <meta-data> by the config plugin
 *      (app.plugin.js) at prebuild time, read from the PICOVOICE_ACCESS_KEY
 *      env var.
 *   2. hey_sara.ppn — a custom wake-word model, also generated for free at
 *      the Picovoice Console (Porcupine -> train a custom keyword -> type
 *      "Hey Sara" -> pick Android platform -> download). Drop it at
 *      frontend/plugins/hello-sara-native/android/assets/hey_sara.ppn and
 *      the plugin copies it into the native project automatically.
 *
 * On wake-word detection this launches MainActivity with a deep link into
 * the chat screen (frontend://chat?autostart=1), which the app's Expo
 * Router linking config picks up to auto-start listening.
 */
class WakeWordService : Service() {
    private var porcupineManager: PorcupineManager? = null
    private val TAG = "WakeWordService"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val channelId = "hello_sara_wake"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(channelId, "Sara listening", NotificationManager.IMPORTANCE_LOW)
            mgr.createNotificationChannel(channel)
        }
        val notif = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Sara")
            .setContentText("Listening for \"Hey Sara\"")
            .setOngoing(true)
            .build()
        startForeground(1042, notif)

        startPorcupine()

        return START_STICKY
    }

    private fun startPorcupine() {
        val accessKey = readMetaData("com.hellosara.PICOVOICE_ACCESS_KEY")
        if (accessKey.isNullOrBlank()) {
            Log.w(TAG, "PICOVOICE_ACCESS_KEY not set — wake word disabled. Set it in .env and re-run expo prebuild.")
            return
        }

        val keywordPath = "hey_sara.ppn" // copied into assets/ by the config plugin
        if (!assetExists(keywordPath)) {
            Log.w(TAG, "$keywordPath not found in assets — generate it at console.picovoice.ai and drop it in plugins/hello-sara-native/android/assets/.")
            return
        }

        try {
            porcupineManager = PorcupineManager.Builder()
                .setAccessKey(accessKey)
                .setKeywordPath(keywordPath)
                .setSensitivity(0.6f)
                .build(applicationContext, object : PorcupineManagerCallback {
                    override fun invoke(keywordIndex: Int) {
                        onWakeWordDetected()
                    }
                })
            porcupineManager?.start()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Porcupine: ${e.message}")
        }
    }

    private fun onWakeWordDetected() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("frontend://chat?autostart=1")).apply {
            setPackage(applicationContext.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        startActivity(intent)
    }

    private fun readMetaData(key: String): String? {
        return try {
            val appInfo = packageManager.getApplicationInfo(packageName, android.content.pm.PackageManager.GET_META_DATA)
            appInfo.metaData?.getString(key)
        } catch (e: Exception) {
            null
        }
    }

    private fun assetExists(name: String): Boolean {
        return try { assets.open(name).close(); true } catch (e: Exception) { false }
    }

    override fun onDestroy() {
        porcupineManager?.stop()
        porcupineManager?.delete()
        super.onDestroy()
    }
}
