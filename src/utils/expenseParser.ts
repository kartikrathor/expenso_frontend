import { DEFAULT_MERCHANT, getMerchantsCatalog } from '../constants/merchants';
import { CategoryId, MerchantId, ParsedExpenseInput } from '../types/expense';

const HINDI_NUMBERS: Record<string, number> = {
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
  'छह': 6, 'छ': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15,
  'बीस': 20, 'पचास': 50, 'सौ': 100, 'sau': 100, 'हज़ार': 1000, 'हजार': 1000,
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'ten': 10, 'twenty': 20, 'fifty': 50, 'hundred': 100,
};

const MERCHANT_ALIASES: Record<string, string> = {
  'blink it': 'blinkit', 'blink': 'blinkit', 'ब्लिंक': 'blinkit',
  'amz': 'amazon', 'amazon.in': 'amazon',
  'flip kart': 'flipkart', 'fk': 'flipkart',
  'zomato food': 'zomato', 'swiggy food': 'swiggy',
};

function extractAmount(text: string): number | null {
  const normalized = text.toLowerCase().trim();

  const digitPatterns = [
    /(?:rs\.?|₹|rupees?|rupaye?|rupya|inr|रुपय[eे]?|रु\.?)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i,
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:rs\.?|₹|rupees?|rupaye?|rupya|inr|रुपय[eे]?|रु\.?)/i,
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:ka|ke|k[e]?|me|men|par|pe|on|for|in|में|का|के|पर|pe)/i,
    /(?:spent|spend|save|saved|paid|pay|kharch|खर्च|diya|दिया|lage|laga|lag[eey]|द[eey]?)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i,
    /(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s|$)/,
  ];

  for (const pattern of digitPatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(amount) && amount > 0) return amount;
    }
  }

  for (const [word, value] of Object.entries(HINDI_NUMBERS)) {
    if (normalized.includes(word)) {
      const hundredMatch = normalized.match(new RegExp(`(${word})\\s*(?:सौ|sau)`, 'i'));
      if (hundredMatch) return value * 100;

      const thousandMatch = normalized.match(new RegExp(`(${word})\\s*(?:हज़ार|हजार|hazaar|hazar)`, 'i'));
      if (thousandMatch) return value * 1000;

      if (value >= 10) return value;
    }
  }

  return null;
}

// Keyword → category fallback when no known merchant is detected
const CATEGORY_KEYWORDS: { keywords: string[]; category: CategoryId }[] = [
  {
    keywords: [
      'pizza', 'burger', 'restaurant', 'cafe', 'coffee', 'tea', 'chai', 'food', 'meal',
      'lunch', 'dinner', 'breakfast', 'biryani', 'dosa', 'idli', 'thali', 'noodles', 'roll',
      'sandwich', 'juice', 'smoothie', 'bakery', 'eat', 'dine', 'snack', 'maggi',
      'dhaba', 'hotel', 'bar', 'pub', 'ccd', 'starbucks', 'subway', 'momos', 'momo',
      'shawarma', 'samosa', 'paratha', 'roti', 'pasta', 'tiffin', 'khana', 'nashta',
      'dominos', 'mcdonalds', 'kfc', 'icecream', 'ice cream',
    ],
    category: 'food',
  },
  {
    keywords: [
      'grocery', 'groceries', 'sabzi', 'vegetable', 'fruit', 'milk', 'bread', 'egg',
      'rice', 'dal', 'atta', 'flour', 'oil', 'supermarket', 'kirana', 'bazaar',
      'market', 'reliance fresh', 'dmart', 'big bazaar', 'more', 'spencers', 'doodh', 'ration',
    ],
    category: 'groceries',
  },
  {
    keywords: [
      'shirt', 'jeans', 'shoes', 'clothes', 'clothing', 'dress', 'kurta', 'saree',
      'watch', 'bag', 'purse', 'accessories', 'jewellery', 'sneakers', 'shopping',
      'mall', 'store', 'brand', 'fashion', 'online order',
    ],
    category: 'shopping',
  },
  {
    keywords: [
      'petrol', 'diesel', 'fuel', 'cng', 'metro', 'bus', 'auto', 'rickshaw', 'cab',
      'taxi', 'train', 'flight', 'travel', 'toll', 'parking', 'rapido', 'bike',
    ],
    category: 'transport',
  },
  {
    keywords: [
      'movie', 'cinema', 'pvr', 'inox', 'bookmyshow', 'game', 'gaming', 'concert',
      'show', 'ticket', 'event', 'sport', 'streaming', 'subscription', 'hotstar',
      'prime', 'zee5', 'jiocinema', 'disney', 'youtube premium',
    ],
    category: 'entertainment',
  },
  {
    keywords: [
      'electricity', 'water bill', 'gas bill', 'gas', 'light', 'light bill', 'bijli',
      'current', 'current bill', 'lpg', 'cylinder', 'indane', 'internet', 'broadband', 'wifi',
      'recharge', 'mobile', 'phone bill', 'dth', 'cable', 'emi', 'rent', 'insurance',
      'loan', 'bill', 'utility', 'airtel', 'jio', 'vi', 'vodafone', 'bsnl', 'maintenance',
    ],
    category: 'bills',
  },
  {
    keywords: [
      'medicine', 'medical', 'doctor', 'hospital', 'clinic', 'pharmacy', 'chemist',
      'health', 'apollo', 'netmeds', '1mg', 'medplus', 'tablet', 'injection',
      'pathology', 'lab test', 'blood test', 'scan', 'xray', 'dental', 'gym', 'dawai',
    ],
    category: 'health',
  },
];

/** Remote learned terms (longest match wins) */
let learnedTerms: Array<{ term: string; category: CategoryId }> = [];

export function setLearnedCategoryTerms(map: Record<string, string>) {
  learnedTerms = Object.entries(map || {})
    .filter(([term, cat]) => term && cat)
    .map(([term, category]) => ({ term: term.toLowerCase(), category }))
    .sort((a, b) => b.term.length - a.term.length);
}

function detectCategoryFromKeywords(text: string): CategoryId | null {
  const lower = text.toLowerCase();

  for (const { term, category } of learnedTerms) {
    if (lower.includes(term)) return category;
  }

  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return null;
}

function detectMerchant(text: string): { id: MerchantId; label: string; category: CategoryId } {
  let normalized = text.toLowerCase();
  for (const [alias, id] of Object.entries(MERCHANT_ALIASES)) {
    if (normalized.includes(alias)) normalized = normalized.replace(alias, id);
  }

  const catalog = getMerchantsCatalog();
  for (const merchant of catalog) {
    for (const keyword of merchant.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return { id: merchant.id, label: merchant.label, category: merchant.category };
      }
    }
  }

  // No merchant match — try to infer category from text keywords
  const inferredCategory = detectCategoryFromKeywords(text);
  return { id: 'default', label: DEFAULT_MERCHANT.label, category: inferredCategory ?? 'other' };
}

export function parseExpenseText(text: string): ParsedExpenseInput {
  const trimmed = text.trim();
  const amount = extractAmount(trimmed);
  const merchant = detectMerchant(trimmed);

  let note = trimmed;
  if (amount) {
    note = trimmed
      .replace(/\d+(?:,\d{3})*(?:\.\d+)?/g, '')
      .replace(/(?:rs\.?|₹|rupees?|rupaye?|रुपय[eे]?)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  for (const m of getMerchantsCatalog()) {
    for (const kw of m.keywords) {
      note = note.replace(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
    }
  }

  return {
    amount,
    merchant: merchant.id,
    merchantLabel: merchant.id === 'default' && note ? note.slice(0, 30) : merchant.label,
    category: merchant.category,
    note: note || trimmed,
  };
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return formatCurrency(amount);
}
