package com.kriovent.expenso

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent

class ExpenseWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    for (id in appWidgetIds) {
      ExpenseWidgetUpdater.updateAppWidget(context, appWidgetManager, id)
    }
  }

  override fun onEnabled(context: Context) {
    ExpenseWidgetUpdater.refreshAll(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ExpenseWidgetUpdater.ACTION_SYNC -> {
        ExpenseWidgetUpdater.syncFromServer(context.applicationContext)
      }
      AppWidgetManager.ACTION_APPWIDGET_UPDATE -> {
        // handled by onUpdate via super path for standard updates
      }
    }
  }
}
