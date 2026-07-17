package com.emergent.completepromptpdf

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import com.facebook.react.bridge.*

/**
 * AppLauncher Module — native Android bridge to:
 * 1. Query all installed apps via PackageManager
 * 2. Launch any app by package name
 * 3. Requires QUERY_ALL_PACKAGES permission (safe, read-only for installed apps)
 */
class AppLauncherModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppLauncher"

    /**
     * Get list of all installed apps.
     * Returns: [{ packageName, appName, label }, ...]
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)

            val apps = mutableListOf<WritableMap>()
            for (app in packages) {
                // Skip system apps (optional; set includeSystem = false to hide them)
                val isSystem = (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                if (isSystem) continue // Remove this line to include system apps

                val label = try {
                    pm.getApplicationLabel(app).toString()
                } catch (e: Exception) {
                    app.packageName
                }

                val appMap = Arguments.createMap()
                appMap.putString("packageName", app.packageName)
                appMap.putString("appName", app.packageName.substringAfterLast("."))
                appMap.putString("label", label)
                apps.add(appMap)
            }

            promise.resolve(Arguments.fromList(apps))
        } catch (e: Exception) {
            promise.reject("GET_APPS_ERROR", e.message, e)
        }
    }

    /**
     * Launch an app by package name.
     */
    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val intent = pm.getLaunchIntentForPackage(packageName)

            if (intent != null) {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.reject("APP_NOT_FOUND", "App with package $packageName not found")
            }
        } catch (e: Exception) {
            promise.reject("LAUNCH_ERROR", e.message, e)
        }
    }

    /**
     * Search for an app and launch it.
     * Uses fuzzy matching on the JS side, then calls launchApp with the matched packageName.
     */
    @ReactMethod
    fun searchAndLaunchApp(appName: String, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)

            // Simple substring matching fallback (better matching is on JS side)
            for (app in packages) {
                val label = try {
                    pm.getApplicationLabel(app).toString().lowercase()
                } catch (e: Exception) {
                    app.packageName.lowercase()
                }

                if (label.contains(appName.lowercase())) {
                    val intent = pm.getLaunchIntentForPackage(app.packageName)
                    if (intent != null) {
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        reactApplicationContext.startActivity(intent)
                        promise.resolve(Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("packageName", app.packageName)
                            putString("label", label)
                        })
                        return
                    }
                }
            }

            promise.reject("APP_NOT_FOUND", "No app matching '$appName' found")
        } catch (e: Exception) {
            promise.reject("SEARCH_ERROR", e.message, e)
        }
    }
}
