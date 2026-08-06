package com.kriovent.expenso

import android.content.Intent
import android.os.Bundle
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability

class MainActivity : ReactActivity() {

  private lateinit var appUpdateManager: AppUpdateManager
  private var updateFlowActive = false

  private val updateResultLauncher: ActivityResultLauncher<IntentSenderRequest> =
    registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) {
      updateFlowActive = false
      // Strict update gate: if Play's immediate flow was cancelled or failed,
      // offer it again instead of allowing an outdated build to continue.
      window.decorView.postDelayed({ checkForImmediateUpdate() }, 500)
    }

  override fun getMainComponentName(): String = "ExpenseWise"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Ensure Linking sees the launch intent (widget / shortcut deep link)
    intent?.let { setIntent(it) }
    appUpdateManager = AppUpdateManagerFactory.create(this)
    checkForImmediateUpdate()
  }

  override fun onResume() {
    super.onResume()
    if (::appUpdateManager.isInitialized) {
      checkForImmediateUpdate()
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Required for singleTask so React Native Linking receives URL while app is open
    setIntent(intent)
  }

  private fun checkForImmediateUpdate() {
    // Play in-app updates only work for Play-installed release builds.
    if (BuildConfig.DEBUG || updateFlowActive || !::appUpdateManager.isInitialized) return

    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { updateInfo ->
        val availability = updateInfo.updateAvailability()
        val shouldStart =
          availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ||
            (
              availability == UpdateAvailability.UPDATE_AVAILABLE &&
                updateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
              )

        if (!shouldStart || updateFlowActive) return@addOnSuccessListener

        updateFlowActive = true
        val started = appUpdateManager.startUpdateFlowForResult(
          updateInfo,
          updateResultLauncher,
          AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
        )
        if (!started) updateFlowActive = false
      }
      .addOnFailureListener {
        updateFlowActive = false
      }
  }
}
