package com.kriovent.expenso

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class ApiConfigModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ApiConfig"

  override fun getConstants(): MutableMap<String, Any> =
    hashMapOf("apiBaseUrl" to BuildConfig.API_BASE_URL)
}
