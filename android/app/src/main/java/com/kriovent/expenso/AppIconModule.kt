package com.kriovent.expenso

import android.content.ComponentName
import android.content.pm.PackageManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Switches the launcher icon via activity-aliases named MainActivity{IconKey}.
 * IconKey "Default" maps to MainActivityDefault (enabled at install).
 *
 * Never leaves the app with zero launcher aliases enabled (Pixel / Android 14+
 * can otherwise make the app unopenable from the home screen).
 */
class AppIconModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppIcon"

  private val pkg: String
    get() = reactContext.packageName

  companion object {
    val ICON_KEYS =
      listOf(
        "Default",
        "Mint",
        "Sunset",
        "Royal",
        "Rose",
        "Lavender",
        "Mono",
        "Forest",
        "MidnightGold",
        "Paper",
        "Neon",
        "RedWebSpider",
      )

    fun componentFor(packageName: String, iconKey: String): ComponentName {
      val key = if (iconKey.isBlank()) "Default" else iconKey
      return ComponentName(packageName, "$packageName.MainActivity$key")
    }

    fun isEnabled(pm: PackageManager, packageName: String, iconKey: String): Boolean {
      val state = pm.getComponentEnabledSetting(componentFor(packageName, iconKey))
      return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
        (iconKey == "Default" && state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)
    }

    fun currentEnabledKey(pm: PackageManager, packageName: String): String? {
      for (key in ICON_KEYS) {
        if (isEnabled(pm, packageName, key)) return key
      }
      return null
    }

    /**
     * If every alias is disabled (broken icon switch), re-enable Default so the
     * app can be opened from the launcher again.
     */
    fun ensureLauncherAvailable(pm: PackageManager, packageName: String) {
      if (currentEnabledKey(pm, packageName) != null) return
      pm.setComponentEnabledSetting(
        componentFor(packageName, "Default"),
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        PackageManager.DONT_KILL_APP,
      )
    }

    fun applyIcon(pm: PackageManager, packageName: String, targetKey: String) {
      val target = componentFor(packageName, targetKey)

      // 1) Enable target first — never have a window with zero launchers.
      pm.setComponentEnabledSetting(
        target,
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        PackageManager.DONT_KILL_APP,
      )

      // 2) Disable others only after target is enabled.
      for (key in ICON_KEYS) {
        if (key == targetKey) continue
        pm.setComponentEnabledSetting(
          componentFor(packageName, key),
          PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
          PackageManager.DONT_KILL_APP,
        )
      }

      // 3) Safety net
      ensureLauncherAvailable(pm, packageName)
    }
  }

  private fun componentName(iconKey: String): ComponentName =
    componentFor(pkg, iconKey)

  @ReactMethod
  fun getIcon(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      ensureLauncherAvailable(pm, pkg)
      promise.resolve(currentEnabledKey(pm, pkg) ?: "Default")
    } catch (e: Exception) {
      promise.reject("ICON_GET_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun setIcon(iconKey: String?, promise: Promise) {
    val targetKey = if (iconKey.isNullOrBlank()) "Default" else iconKey
    if (targetKey !in ICON_KEYS) {
      promise.reject("ICON_INVALID", "Unknown icon: $targetKey")
      return
    }

    try {
      val pm = reactContext.packageManager
      val current = currentEnabledKey(pm, pkg)
      if (current == targetKey) {
        promise.resolve(targetKey)
        return
      }

      applyIcon(pm, pkg, targetKey)
      // Confirm target is still enabled before returning to JS.
      ensureLauncherAvailable(pm, pkg)
      if (!isEnabled(pm, pkg, targetKey)) {
        // Target somehow missing — fall back to Default so app stays launchable.
        applyIcon(pm, pkg, "Default")
        promise.reject("ICON_SET_FAILED", "Could not enable selected icon")
        return
      }
      promise.resolve(targetKey)
    } catch (e: Exception) {
      // Best-effort recovery so the user can still open the app.
      try {
        ensureLauncherAvailable(reactContext.packageManager, pkg)
      } catch (_: Exception) {
        // ignore
      }
      promise.reject("ICON_SET_FAILED", e.message, e)
    }
  }

  /**
   * Call only AFTER setIcon succeeded and the user confirmed.
   * Closes the app so the launcher refreshes the new icon.
   */
  @ReactMethod
  fun closeApp(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      ensureLauncherAvailable(pm, pkg)
      promise.resolve(true)
      android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
        try {
          reactContext.currentActivity?.finishAndRemoveTask()
            ?: reactContext.currentActivity?.finishAffinity()
        } catch (_: Exception) {
          // ignore
        }
        kotlin.system.exitProcess(0)
      }, 120)
    } catch (e: Exception) {
      promise.reject("ICON_CLOSE_FAILED", e.message, e)
    }
  }
}
