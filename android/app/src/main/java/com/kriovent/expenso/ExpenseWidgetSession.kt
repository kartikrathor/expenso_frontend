package com.kriovent.expenso

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class WidgetExpenseRow(
  val id: String,
  val amount: Double,
  val merchantLabel: String,
  val dateIso: String,
)

object ExpenseWidgetSession {
  private const val PREFS = "expenso_widget_prefs"
  private const val KEY_TOKEN = "auth_token"
  private const val KEY_USER_ID = "user_id"
  private const val KEY_GROUP_ID = "group_id"
  private const val KEY_LABEL = "account_label"
  private const val KEY_RECENT = "recent_expenses_json"
  private const val KEY_DIRTY = "needs_app_refresh"
  private const val KEY_TODAY = "today_total"

  fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveSession(
    context: Context,
    token: String?,
    userId: String?,
    groupId: String?,
    accountLabel: String?,
  ) {
    prefs(context)
      .edit()
      .putString(KEY_TOKEN, token ?: "")
      .putString(KEY_USER_ID, userId ?: "")
      .putString(KEY_GROUP_ID, groupId ?: "")
      .putString(KEY_LABEL, accountLabel?.takeIf { it.isNotBlank() } ?: "Personal")
      .apply()
  }

  fun saveAccountLabel(context: Context, accountLabel: String?) {
    prefs(context)
      .edit()
      .putString(KEY_LABEL, accountLabel?.takeIf { it.isNotBlank() } ?: "Personal")
      .apply()
  }

  fun clearSession(context: Context) {
    prefs(context)
      .edit()
      .remove(KEY_TOKEN)
      .remove(KEY_USER_ID)
      .remove(KEY_GROUP_ID)
      .putString(KEY_LABEL, "Personal")
      .putString(KEY_RECENT, "[]")
      .putFloat(KEY_TODAY, 0f)
      .apply()
  }

  fun token(context: Context): String =
    prefs(context).getString(KEY_TOKEN, "")?.trim().orEmpty()

  fun groupId(context: Context): String =
    prefs(context).getString(KEY_GROUP_ID, "")?.trim().orEmpty()

  fun accountLabel(context: Context): String =
    prefs(context).getString(KEY_LABEL, "Personal") ?: "Personal"

  fun isSignedIn(context: Context): Boolean = token(context).isNotEmpty()

  fun saveRecent(context: Context, rows: List<WidgetExpenseRow>) {
    val arr = JSONArray()
    rows.take(4).forEach { row ->
      arr.put(
        JSONObject()
          .put("id", row.id)
          .put("amount", row.amount)
          .put("merchantLabel", row.merchantLabel)
          .put("date", row.dateIso),
      )
    }
    prefs(context).edit().putString(KEY_RECENT, arr.toString()).apply()
  }

  fun recent(context: Context): List<WidgetExpenseRow> {
    val raw = prefs(context).getString(KEY_RECENT, "[]") ?: "[]"
    return try {
      val arr = JSONArray(raw)
      buildList {
        for (i in 0 until minOf(arr.length(), 4)) {
          val o = arr.getJSONObject(i)
          add(
            WidgetExpenseRow(
              id = o.optString("id", "row_$i"),
              amount = o.optDouble("amount", 0.0),
              merchantLabel = o.optString("merchantLabel", "Expense"),
              dateIso = o.optString("date", ""),
            ),
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  fun prependRecent(context: Context, row: WidgetExpenseRow) {
    val next = listOf(row) + recent(context).filter { it.id != row.id }
    saveRecent(context, next.take(4))
  }

  fun saveTodayTotal(context: Context, todayTotal: Double) {
    prefs(context).edit().putFloat(KEY_TODAY, todayTotal.toFloat()).apply()
  }

  fun todayTotal(context: Context): Double =
    prefs(context).getFloat(KEY_TODAY, 0f).toDouble()

  fun markAppNeedsRefresh(context: Context) {
    prefs(context).edit().putBoolean(KEY_DIRTY, true).apply()
  }

  fun consumeAppNeedsRefresh(context: Context): Boolean {
    val dirty = prefs(context).getBoolean(KEY_DIRTY, false)
    if (dirty) {
      prefs(context).edit().putBoolean(KEY_DIRTY, false).apply()
    }
    return dirty
  }
}
