package com.kriovent.expenso

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.view.MotionEvent
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors

/**
 * Dialog-style Quick Add launched from the home-screen widget.
 * Type or hold-to-speak → POST expense → update widget list → finish.
 * Does not boot the full React Native UI.
 */
class QuickAddExpenseActivity : Activity() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val io = Executors.newSingleThreadExecutor()

  private lateinit var input: EditText
  private lateinit var status: TextView
  private lateinit var micBtn: TextView
  private lateinit var saveBtn: TextView

  private var speechRecognizer: SpeechRecognizer? = null
  private var listening = false
  private var inputMethod = "manual"
  private var saving = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_quick_add)

    input = findViewById(R.id.quick_add_input)
    status = findViewById(R.id.quick_add_status)
    micBtn = findViewById(R.id.quick_add_mic)
    saveBtn = findViewById(R.id.quick_add_save)
    val cancel = findViewById<TextView>(R.id.quick_add_cancel)

    if (!ExpenseWidgetSession.isSignedIn(this)) {
      status.text = getString(R.string.quick_add_need_sign_in)
      Toast.makeText(this, R.string.quick_add_need_sign_in, Toast.LENGTH_LONG).show()
    }

    cancel.setOnClickListener { finish() }
    saveBtn.setOnClickListener { submit() }
    input.setOnEditorActionListener { _, actionId, _ ->
      if (actionId == EditorInfo.IME_ACTION_DONE) {
        submit()
        true
      } else {
        false
      }
    }

    micBtn.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          startListening()
          true
        }
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          stopListening()
          true
        }
        else -> false
      }
    }

    val autoVoice = intent?.getBooleanExtra(ExpenseWidgetUpdater.EXTRA_AUTO_VOICE, false) == true
    val focusToday = intent?.getBooleanExtra(ExpenseWidgetUpdater.EXTRA_FOCUS_TODAY, false) == true
    if (focusToday) {
      val today = ExpenseWidgetSession.todayTotal(this)
      status.text = "Today so far · ₹${today.toLong()}"
    }
    if (autoVoice) {
      // Widget mic tap → jump straight into listen mode
      mainHandler.postDelayed({ startListening() }, 280)
    }
  }

  private fun startListening() {
    if (saving) return
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
      != PackageManager.PERMISSION_GRANTED
    ) {
      ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), REQ_MIC)
      status.text = "Allow microphone to speak"
      return
    }
    if (!SpeechRecognizer.isRecognitionAvailable(this)) {
      status.text = "Speech not available on this device"
      return
    }

    ensureRecognizer()
    listening = true
    inputMethod = "voice"
    status.text = getString(R.string.quick_add_listening)
    micBtn.alpha = 0.7f

    val intent =
      Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
      }
    try {
      speechRecognizer?.startListening(intent)
    } catch (e: Exception) {
      status.text = e.message ?: "Couldn’t start mic"
      listening = false
      micBtn.alpha = 1f
    }
  }

  private fun stopListening() {
    if (!listening) return
    listening = false
    micBtn.alpha = 1f
    try {
      speechRecognizer?.stopListening()
    } catch (_: Exception) {
    }
  }

  private fun ensureRecognizer() {
    if (speechRecognizer != null) return
    speechRecognizer =
      SpeechRecognizer.createSpeechRecognizer(this).also { sr ->
        sr.setRecognitionListener(
          object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {
              listening = false
              micBtn.alpha = 1f
            }

            override fun onError(error: Int) {
              listening = false
              micBtn.alpha = 1f
              if (error != SpeechRecognizer.ERROR_CLIENT &&
                error != SpeechRecognizer.ERROR_NO_MATCH
              ) {
                status.text = "Mic error — try typing"
              }
            }

            override fun onResults(results: Bundle?) {
              val texts =
                results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
              val best = texts?.firstOrNull()?.trim().orEmpty()
              if (best.isNotEmpty()) {
                input.setText(best)
                input.setSelection(best.length)
                status.text = best
                // Auto-save after a successful utterance
                submit()
              }
            }

            override fun onPartialResults(partialResults: Bundle?) {
              val texts =
                partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
              val partial = texts?.firstOrNull()?.trim().orEmpty()
              if (partial.isNotEmpty()) {
                input.setText(partial)
                input.setSelection(partial.length)
              }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
          },
        )
      }
  }

  private fun submit() {
    if (saving) return
    val text = input.text?.toString()?.trim().orEmpty()
    if (text.isEmpty()) {
      status.text = getString(R.string.quick_add_hint)
      return
    }
    val parsed = ExpenseQuickParser.parse(text)
    if (parsed == null) {
      status.text = getString(R.string.quick_add_need_amount)
      return
    }
    val token = ExpenseWidgetSession.token(this)
    if (token.isEmpty()) {
      status.text = getString(R.string.quick_add_need_sign_in)
      Toast.makeText(this, R.string.quick_add_need_sign_in, Toast.LENGTH_LONG).show()
      return
    }

    saving = true
    status.text = getString(R.string.quick_add_saving)
    saveBtn.isEnabled = false
    micBtn.isEnabled = false

    val groupId = ExpenseWidgetSession.groupId(this)
    val method = inputMethod
    io.execute {
      val result =
        ExpenseApiHelper.createExpense(
          BuildConfig.API_BASE_URL,
          token,
          groupId,
          parsed,
          method,
        )
      mainHandler.post {
        saving = false
        saveBtn.isEnabled = true
        micBtn.isEnabled = true
        if (!result.ok || result.row == null) {
          status.text = result.message
          Toast.makeText(this, result.message, Toast.LENGTH_LONG).show()
          return@post
        }
        ExpenseWidgetSession.prependRecent(this, result.row)
        val updatedToday = ExpenseWidgetSession.todayTotal(this) + result.row.amount
        ExpenseWidgetSession.saveTodayTotal(this, updatedToday)
        ExpenseWidgetSession.markAppNeedsRefresh(this)
        ExpenseWidgetUpdater.refreshAll(this)
        Toast.makeText(
          this,
          "₹${result.row.amount.toLong()} · ${result.row.merchantLabel}",
          Toast.LENGTH_SHORT,
        ).show()
        finish()
      }
    }
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray,
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQ_MIC &&
      grantResults.isNotEmpty() &&
      grantResults[0] == PackageManager.PERMISSION_GRANTED
    ) {
      status.text = "Hold mic and speak"
    }
  }

  override fun onDestroy() {
    try {
      speechRecognizer?.destroy()
    } catch (_: Exception) {
    }
    speechRecognizer = null
    io.shutdownNow()
    super.onDestroy()
  }

  companion object {
    private const val REQ_MIC = 42
  }
}
