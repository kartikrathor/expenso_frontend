package com.kriovent.expenso

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale
import java.util.concurrent.Executors
import kotlin.math.roundToLong

object ExpenseWidgetUpdater {
  const val ACTION_SYNC = "com.kriovent.expenso.WIDGET_SYNC"
  const val EXTRA_AUTO_VOICE = "auto_voice"
  const val EXTRA_FOCUS_TODAY = "focus_today"

  private val io = Executors.newSingleThreadExecutor()

  private data class RowIds(val root: Int, val merchant: Int, val amount: Int)

  private val ROWS =
    listOf(
      RowIds(R.id.widget_row_0, R.id.widget_row_0_merchant, R.id.widget_row_0_amount),
      RowIds(R.id.widget_row_1, R.id.widget_row_1_merchant, R.id.widget_row_1_amount),
      RowIds(R.id.widget_row_2, R.id.widget_row_2_merchant, R.id.widget_row_2_amount),
      RowIds(R.id.widget_row_3, R.id.widget_row_3_merchant, R.id.widget_row_3_amount),
    )

  fun refreshAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, ExpenseWidgetProvider::class.java))
    if (ids.isEmpty()) return
    for (id in ids) {
      updateAppWidget(context, manager, id)
    }
  }

  fun syncFromServer(context: Context) {
    io.execute {
      val token = ExpenseWidgetSession.token(context)
      if (token.isEmpty()) {
        refreshAll(context)
        return@execute
      }
      val rows =
        ExpenseApiHelper.fetchRecent(
          BuildConfig.API_BASE_URL,
          token,
          ExpenseWidgetSession.groupId(context),
        )
      if (rows.isNotEmpty()) {
        ExpenseWidgetSession.saveRecent(context, rows)
        // Recompute today from recent if dates are today (best-effort); JS will overwrite
        ExpenseWidgetSession.markAppNeedsRefresh(context)
      }
      refreshAll(context)
    }
  }

  fun updateAppWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, R.layout.widget_expense)
    views.setTextViewText(R.id.widget_account, ExpenseWidgetSession.accountLabel(context))
    views.setTextViewText(
      R.id.widget_today_amount,
      formatInr(ExpenseWidgetSession.todayTotal(context)),
    )

    val recent = ExpenseWidgetSession.recent(context)
    if (recent.isEmpty()) {
      views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
      for (row in ROWS) {
        views.setViewVisibility(row.root, View.GONE)
      }
    } else {
      views.setViewVisibility(R.id.widget_empty, View.GONE)
      for (i in ROWS.indices) {
        val ids = ROWS[i]
        if (i < recent.size) {
          val row = recent[i]
          views.setViewVisibility(ids.root, View.VISIBLE)
          views.setTextViewText(ids.merchant, row.merchantLabel)
          views.setTextViewText(ids.amount, formatInr(row.amount))
        } else {
          views.setViewVisibility(ids.root, View.GONE)
        }
      }
    }

    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    // Type to add
    val addIntent =
      Intent(context, QuickAddExpenseActivity::class.java).apply {
        this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
    views.setOnClickPendingIntent(
      R.id.widget_add_button,
      PendingIntent.getActivity(context, appWidgetId + 2001, addIntent, flags),
    )

    // Mic → Quick Add in auto-listen / hold-to-speak mode
    val micIntent =
      Intent(context, QuickAddExpenseActivity::class.java).apply {
        this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(EXTRA_AUTO_VOICE, true)
      }
    views.setOnClickPendingIntent(
      R.id.widget_mic_button,
      PendingIntent.getActivity(context, appWidgetId + 2002, micIntent, flags),
    )

    // Today → open Quick Add focused on today's context (same dialog, status shows today)
    val todayIntent =
      Intent(context, QuickAddExpenseActivity::class.java).apply {
        this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(EXTRA_FOCUS_TODAY, true)
      }
    val todayPending = PendingIntent.getActivity(context, appWidgetId + 2003, todayIntent, flags)
    views.setOnClickPendingIntent(R.id.widget_today_card, todayPending)
    views.setOnClickPendingIntent(R.id.widget_today_action, todayPending)

    val syncIntent =
      Intent(context, ExpenseWidgetProvider::class.java).apply {
        action = ACTION_SYNC
      }
    views.setOnClickPendingIntent(
      R.id.widget_sync_button,
      PendingIntent.getBroadcast(context, appWidgetId + 3001, syncIntent, flags),
    )

    manager.updateAppWidget(appWidgetId, views)
  }

  private fun formatInr(amount: Double): String {
    val rounded = amount.roundToLong()
    val formatted =
      NumberFormat.getNumberInstance(Locale.forLanguageTag("en-IN")).format(rounded)
    return "₹$formatted"
  }
}
