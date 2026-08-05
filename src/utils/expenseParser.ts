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

/** e.g. "12 + 20", "100*2", "50 - 10 + 5" */
const MATH_EXPR_RE =
  /(\d+(?:,\d{3})*(?:\.\d+)?(?:\s*[+\-*/×÷xX]\s*\d+(?:,\d{3})*(?:\.\d+)?)+)/;

/** Safe evaluator for + - * / (no Function/eval). * / before + -. */
function evaluateMathExpression(expr: string): number | null {
  const normalized = expr
    .replace(/,/g, '')
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '');

  if (!/^[\d.+\-*/]+$/.test(normalized)) return null;

  const tokens = normalized.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.length < 3) return null;

  const values: number[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    if (token === '+' || token === '-' || token === '*' || token === '/') {
      ops.push(token);
    } else {
      const n = parseFloat(token);
      if (isNaN(n)) return null;
      values.push(n);
    }
  }

  if (values.length !== ops.length + 1) return null;

  // Pass 1: * and /
  let i = 0;
  while (i < ops.length) {
    if (ops[i] === '*' || ops[i] === '/') {
      const a = values[i];
      const b = values[i + 1];
      if (ops[i] === '/' && b === 0) return null;
      const result = ops[i] === '*' ? a * b : a / b;
      values.splice(i, 2, result);
      ops.splice(i, 1);
    } else {
      i += 1;
    }
  }

  // Pass 2: + and -
  let result = values[0];
  for (let j = 0; j < ops.length; j++) {
    if (ops[j] === '+') result += values[j + 1];
    else result -= values[j + 1];
  }

  if (!isFinite(result) || result <= 0) return null;
  // Keep currency-friendly precision
  return Math.round(result * 100) / 100;
}

function extractMathAmount(text: string): number | null {
  const match = text.match(MATH_EXPR_RE);
  if (!match?.[1]) return null;
  return evaluateMathExpression(match[1]);
}

function extractAmount(text: string): number | null {
  const normalized = text.toLowerCase().trim();

  // Prefer calculated expressions: "Blinkit 12 + 20" → 32
  const mathAmount = extractMathAmount(normalized);
  if (mathAmount != null) return mathAmount;

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
      'rent', 'kiraya', 'house rent', 'pg rent', 'hostel rent', 'flat rent', 'room rent',
    ],
    category: 'rent',
  },
  {
    keywords: [
      'tax', 'taxes', 'gst', 'tds', 'income tax', 'property tax', 'advance tax',
    ],
    category: 'taxes',
  },
  {
    keywords: [
      'gift', 'gifts', 'present', 'birthday gift', 'anniversary gift', 'wedding gift',
    ],
    category: 'gifts',
  },
  {
    keywords: [
      'donation', 'donate', 'charity', 'daan', 'ngo', 'temple donation', 'zakat',
    ],
    category: 'donation',
  },
  {
    keywords: [
      'insurance', 'premium', 'term plan', 'health insurance', 'life insurance',
      'car insurance', 'bike insurance', 'policybazaar',
    ],
    category: 'insurance',
  },
  {
    keywords: [
      'salon', 'spa', 'haircut', 'grooming', 'cosmetics', 'skincare', 'parlour',
      'makeup', 'facial', 'manicure', 'pedicure', 'barber',
    ],
    category: 'personal_care',
  },
  {
    keywords: [
      'electricity', 'water bill', 'gas bill', 'gas', 'light', 'light bill', 'bijli',
      'current', 'current bill', 'lpg', 'cylinder', 'indane', 'internet', 'broadband', 'wifi',
      'recharge', 'mobile', 'phone bill', 'dth', 'cable', 'emi',
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

function detectLearnedCategory(text: string): CategoryId | null {
  const lower = text.toLowerCase();
  for (const { term, category } of learnedTerms) {
    if (lower.includes(term)) return category;
  }
  return null;
}

function detectCategoryFromKeywords(text: string): CategoryId | null {
  const learned = detectLearnedCategory(text);
  if (learned) return learned;
  const lower = text.toLowerCase();
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return null;
}

function detectMerchant(text: string): { id: MerchantId; label: string; category: CategoryId } {
  let normalized = text.toLowerCase();
  const learnedCategory = detectLearnedCategory(text);
  for (const [alias, id] of Object.entries(MERCHANT_ALIASES)) {
    if (normalized.includes(alias)) normalized = normalized.replace(alias, id);
  }

  const catalog = getMerchantsCatalog();
  for (const merchant of catalog) {
    for (const keyword of merchant.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return {
          id: merchant.id,
          label: merchant.label,
          category: learnedCategory ?? merchant.category,
        };
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
      .replace(MATH_EXPR_RE, '')
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
  const formatUnit = (value: number, unit: string) =>
    `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${unit}`;
  const absolute = Math.abs(amount);

  if (absolute >= 10000000) return formatUnit(amount / 10000000, 'Cr');
  if (absolute >= 100000) return formatUnit(amount / 100000, 'L');
  if (absolute >= 1000) return formatUnit(amount / 1000, 'K');
  return formatCurrency(amount);
}
