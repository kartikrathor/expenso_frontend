package com.kriovent.expenso

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(ApiConfigPackage())
          add(AppIconPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Recover if a previous icon switch disabled every launcher alias.
    try {
      AppIconModule.ensureLauncherAvailable(packageManager, packageName)
    } catch (_: Exception) {
      // ignore — app still boots; launcher may need reinstall in worst case
    }
    loadReactNative(this)
  }
}
