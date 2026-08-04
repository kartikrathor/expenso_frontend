package com.kriovent.expenso

data class ParsedQuickExpense(
  val amount: Double,
  val merchant: String,
  val merchantLabel: String,
  val category: String,
  val note: String,
)

/**
 * Lightweight native parser for widget Quick Add (Blinkit 200 / "swiggy me 350").
 * Mirrors the common cases from JS expenseParser — not the full Hinglish engine.
 */
object ExpenseQuickParser {
  private data class Merchant(
    val id: String,
    val label: String,
    val category: String,
    val keywords: List<String>,
  )

  private val MERCHANTS =
    listOf(
      Merchant("blinkit", "Blinkit", "groceries", listOf("blinkit", "blink it", "ब्लिंकिट")),
      Merchant("zepto", "Zepto", "groceries", listOf("zepto", "ज़ेप्टो")),
      Merchant("swiggy", "Swiggy", "food", listOf("swiggy", "स्विगी")),
      Merchant("zomato", "Zomato", "food", listOf("zomato", "ज़ोमैटो", "जोमैटो")),
      Merchant("amazon", "Amazon", "shopping", listOf("amazon", "amzn", "अमेजन")),
      Merchant("flipkart", "Flipkart", "shopping", listOf("flipkart", "flip kart")),
      Merchant("myntra", "Myntra", "shopping", listOf("myntra")),
      Merchant("uber", "Uber", "transport", listOf("uber")),
      Merchant("ola", "Ola", "transport", listOf("ola")),
      Merchant("rapido", "Rapido", "transport", listOf("rapido")),
      Merchant("bigbasket", "BigBasket", "groceries", listOf("bigbasket", "big basket")),
      Merchant("dmart", "DMart", "groceries", listOf("dmart", "d mart")),
      Merchant("petrol", "Petrol", "transport", listOf("petrol", "diesel", "fuel", "cng")),
    )

  private val AMOUNT_PATTERNS =
    listOf(
      Regex("""(?:rs\.?|₹|rupees?|rupaye?|inr|रु\.?)\s*(\d+(?:,\d{3})*(?:\.\d+)?)""", RegexOption.IGNORE_CASE),
      Regex("""(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:rs\.?|₹|rupees?|rupaye?|inr|रु\.?)""", RegexOption.IGNORE_CASE),
      Regex("""(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:ka|ke|me|men|par|pe|on|for|in|में|का|के|पर)""", RegexOption.IGNORE_CASE),
      Regex("""(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s|$)"""),
    )

  fun parse(raw: String): ParsedQuickExpense? {
    val text = raw.trim()
    if (text.isEmpty()) return null

    val amount = extractAmount(text) ?: return null
    val lower = text.lowercase()

    val matched =
      MERCHANTS.firstOrNull { m ->
        m.keywords.any { kw -> lower.contains(kw.lowercase()) }
      }

    val merchantId = matched?.id ?: "default"
    val merchantLabel =
      matched?.label
        ?: guessLabel(text, amount)
        ?: "Expense"
    val category = matched?.category ?: "other"

    return ParsedQuickExpense(
      amount = amount,
      merchant = merchantId,
      merchantLabel = merchantLabel,
      category = category,
      note = text,
    )
  }

  private fun extractAmount(text: String): Double? {
    for (pattern in AMOUNT_PATTERNS) {
      val match = pattern.find(text.lowercase()) ?: continue
      val n = match.groupValues.getOrNull(1)?.replace(",", "")?.toDoubleOrNull()
      if (n != null && n > 0) return (Math.round(n * 100.0) / 100.0)
    }
    return null
  }

  private fun guessLabel(text: String, amount: Double): String? {
    var cleaned =
      text
        .replace(Regex("""(?:rs\.?|₹|rupees?|rupaye?|inr|रु\.?)""", RegexOption.IGNORE_CASE), " ")
        .replace(amount.toString(), " ")
        .replace(Regex("""\d+(?:,\d{3})*(?:\.\d+)?"""), " ")
        .replace(Regex("""\s+"""), " ")
        .trim()
    if (cleaned.length < 2) return null
    return cleaned.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
  }
}
