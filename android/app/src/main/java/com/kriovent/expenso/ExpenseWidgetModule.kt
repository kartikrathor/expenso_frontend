package com.kriovent.expenso

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ExpenseWidgetModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ExpenseWidget"

  @ReactMethod
  fun setSession(token: String?, userId: String?, groupId: String?, accountLabel: String?) {
    ExpenseWidgetSession.saveSession(
      reactContext.applicationContext,
      token,
      userId,
      groupId,
      accountLabel,
    )
    ExpenseWidgetUpdater.refreshAll(reactContext.applicationContext)
  }

  @ReactMethod
  fun clearSession() {
    ExpenseWidgetSession.clearSession(reactContext.applicationContext)
    ExpenseWidgetUpdater.refreshAll(reactContext.applicationContext)
  }

  @ReactMethod
  fun updateStats(
    todayTotal: Double,
    monthTotal: Double,
    budget: Double,
    accountLabel: String?,
  ) {
    ExpenseWidgetSession.saveAccountLabel(reactContext.applicationContext, accountLabel)
    ExpenseWidgetUpdater.refreshAll(reactContext.applicationContext)
  }

  @ReactMethod
  fun setAccountLabel(accountLabel: String?) {
    ExpenseWidgetSession.saveAccountLabel(reactContext.applicationContext, accountLabel)
    ExpenseWidgetUpdater.refreshAll(reactContext.applicationContext)
  }

  @ReactMethod
  fun setTodayTotal(todayTotal: Double) {
    ExpenseWidgetSession.saveTodayTotal(reactContext.applicationContext, todayTotal)
    ExpenseWidgetUpdater.refreshAll(reactContext.applicationContext)
  }

  /**
   * Push last expenses into the widget.
   * Each item: { id, amount, merchantLabel, date }
   */
  @ReactMethod
  fun setRecentExpenses(rows: ReadableArray?) {
    val list = mutableListOf<WidgetExpenseRow>()
    if (rows != null) {
      for (i in 0 until minOf(rows.size(), 4)) {
        val map = rows.getMap(i) ?: continue
        list.add(
          WidgetExpenseRow(
            id = map.getString("id") ?: "row_$i",
            amount = if (map.hasKey("amount")) map.getDouble("amount") else 0.0,
            merchantLabel = map.getString("merchantLabel") ?: "Expense",
            dateIso = map.getString("date") ?: "",
          ),
        )
      }
    }
    ExpenseWidgetSession.saveRecent(reactContext.applicationContext, list)
    ExpenseWidgetUpdater.refreshAll(reactContext.applicationContext)
  }

  @ReactMethod
  fun refresh() {
    ExpenseWidgetUpdater.refreshAll(reactContext.applicationContext)
  }

  @ReactMethod
  fun syncFromServer() {
    ExpenseWidgetUpdater.syncFromServer(reactContext.applicationContext)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun consumeNeedsRefresh(): Boolean {
    return ExpenseWidgetSession.consumeAppNeedsRefresh(reactContext.applicationContext)
  }
}
