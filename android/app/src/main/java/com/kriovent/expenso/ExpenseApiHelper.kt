package com.kriovent.expenso

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object ExpenseApiHelper {
  data class Result(
    val ok: Boolean,
    val message: String,
    val row: WidgetExpenseRow? = null,
  )

  fun createExpense(
    baseUrl: String,
    token: String,
    groupId: String,
    parsed: ParsedQuickExpense,
    inputMethod: String,
  ): Result {
    val iso = isoNow()
    return try {
      if (groupId.isNotBlank()) {
        val body =
          JSONObject()
            .put("amount", parsed.amount)
            .put("merchantLabel", parsed.merchantLabel)
            .put("category", parsed.category)
            .put("note", parsed.note)
            .put("date", iso)
        val res = request("POST", "$baseUrl/api/groups/$groupId/expenses", token, body)
        if (!res.ok) return Result(false, res.message)
        val expense = res.json?.optJSONObject("expense")
        val row =
          WidgetExpenseRow(
            id =
              expense?.optString("id")?.takeIf { it.isNotBlank() }
                ?: expense?.optString("_id")
                ?: "local_${System.currentTimeMillis()}",
            amount = expense?.optDouble("amount", parsed.amount) ?: parsed.amount,
            merchantLabel =
              expense?.optString("merchantLabel")?.takeIf { it.isNotBlank() }
                ?: parsed.merchantLabel,
            dateIso =
              expense?.optString("date")?.takeIf { it.isNotBlank() }
                ?: expense?.optString("createdAt")?.takeIf { it.isNotBlank() }
                ?: iso,
          )
        Result(true, "Added", row)
      } else {
        val body =
          JSONObject()
            .put("amount", parsed.amount)
            .put("merchantLabel", parsed.merchantLabel)
            .put("merchant", parsed.merchant)
            .put("category", parsed.category)
            .put("note", parsed.note)
            .put("date", iso)
            .put("inputMethod", inputMethod)
        val res = request("POST", "$baseUrl/api/expenses", token, body)
        if (!res.ok) return Result(false, res.message)
        val expense = res.json?.optJSONObject("expense")
        val row =
          WidgetExpenseRow(
            id =
              expense?.optString("id")?.takeIf { it.isNotBlank() }
                ?: expense?.optString("_id")
                ?: "local_${System.currentTimeMillis()}",
            amount = expense?.optDouble("amount", parsed.amount) ?: parsed.amount,
            merchantLabel =
              expense?.optString("merchantLabel")?.takeIf { it.isNotBlank() }
                ?: parsed.merchantLabel,
            dateIso =
              expense?.optString("date")?.takeIf { it.isNotBlank() }
                ?: expense?.optString("createdAt")?.takeIf { it.isNotBlank() }
                ?: iso,
          )
        Result(true, "Added", row)
      }
    } catch (e: Exception) {
      Result(false, e.message ?: "Network error")
    }
  }

  fun fetchRecent(
    baseUrl: String,
    token: String,
    groupId: String,
  ): List<WidgetExpenseRow> {
    return try {
      val path =
        if (groupId.isNotBlank()) {
          "/api/groups/$groupId/expenses"
        } else {
          "/api/expenses"
        }
      val res = request("GET", "$baseUrl$path", token, null)
      if (!res.ok) return emptyList()
      val arr =
        res.json?.optJSONArray("expenses")
          ?: res.json?.optJSONArray("items")
          ?: JSONArray()
      buildList {
        for (i in 0 until minOf(arr.length(), 4)) {
          val o = arr.getJSONObject(i)
          add(
            WidgetExpenseRow(
              id =
                o.optString("id").takeIf { it.isNotBlank() }
                  ?: o.optString("_id", "row_$i"),
              amount = o.optDouble("amount", 0.0),
              merchantLabel = o.optString("merchantLabel", "Expense"),
              dateIso = o.optString("date", o.optString("createdAt", "")),
            ),
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private data class HttpResult(
    val ok: Boolean,
    val message: String,
    val json: JSONObject? = null,
  )

  private fun request(
    method: String,
    urlStr: String,
    token: String,
    body: JSONObject?,
  ): HttpResult {
    val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
      requestMethod = method
      connectTimeout = 15000
      readTimeout = 20000
      setRequestProperty("Authorization", "Bearer $token")
      setRequestProperty("Accept", "application/json")
      if (body != null) {
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
      }
    }
    try {
      if (body != null) {
        OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
      }
      val code = conn.responseCode
      val stream = if (code in 200..299) conn.inputStream else conn.errorStream
      val text =
        stream?.let { BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { r -> r.readText() } }
          ?: ""
      val json =
        try {
          if (text.isBlank()) null else JSONObject(text)
        } catch (_: Exception) {
          null
        }
      if (code in 200..299) {
        return HttpResult(true, "OK", json)
      }
      val msg =
        json?.optString("error")?.takeIf { it.isNotBlank() }
          ?: json?.optString("message")?.takeIf { it.isNotBlank() }
          ?: "Error $code"
      return HttpResult(false, msg, json)
    } finally {
      conn.disconnect()
    }
  }

  private fun isoNow(): String {
    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    sdf.timeZone = TimeZone.getTimeZone("UTC")
    return sdf.format(Date())
  }
}
