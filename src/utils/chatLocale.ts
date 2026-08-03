export type ChatLang = 'en' | 'hi';

const HI_ROMAN = [
  'kya', 'hai', 'kitna', 'kitne', 'kharch', 'bacha', 'bachaye', 'kaise', 'kahan',
  'zyada', 'jyada', 'maine', 'mera', 'mere', 'usne', 'uska', 'partner', 'dono',
  'aaj', 'kal', 'mahine', 'paisa', 'theek', 'sahi', 'madad', 'batao', 'poochh',
  'kab', 'nahi', 'haan', 'matlab', 'thoda', 'zyadaa', 'kam',
];

/** Scripts we can detect but don't ship native replies for yet → English UI. */
const UNSUPPORTED_SCRIPTS =
  /[\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0980-\u09FF\u0A80-\u0AFF\u0A00-\u0A7F\u0B00-\u0B7F]/;

/**
 * Detect reply language from latest user text.
 * Supported: English + Hindi. Other Indic scripts → English chips/UI
 * (server still answers in English with a notice).
 */
export function detectChatLang(text: string): ChatLang {
  const t = (text || '').trim();
  if (!t) return 'en';
  if (UNSUPPORTED_SCRIPTS.test(t)) return 'en';
  if (/[\u0900-\u097F]/.test(t)) return 'hi'; // Devanagari
  const lower = t.toLowerCase().replace(/[^\p{L}\s]/gu, ' ');
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 'en';
  const hiHits = tokens.filter(w => HI_ROMAN.includes(w)).length;
  if (hiHits >= 2 || (hiHits >= 1 && tokens.length <= 4)) return 'hi';
  return 'en';
}

type ChipSet = {
  default: string[];
  joint: string[];
};

export const WELCOME: Record<ChatLang, { solo: string; joint: string }> = {
  en: {
    solo: 'Hey! Ask about spending, save tips, budget health, or daily average 👇',
    joint: 'Hey! Ask about joint spend, your share vs partner, tips, or budget check 👇',
  },
  hi: {
    solo: 'Hey! Kharch, save tips, budget check, ya avg/day — jo poochho 👇',
    joint: 'Hey! Joint spend, maine/partner kitna, tips, budget — sab poochho 👇',
  },
};

export const START_CHIPS: Record<ChatLang, ChipSet> = {
  en: {
    default: ['Is spending okay?', 'How to save?', 'Where am I overspending?', 'Budget left?'],
    joint: ['How much did I spend?', 'Partner spend?', 'Is spending okay?', 'How to save?'],
  },
  hi: {
    default: ['Kya spending theek?', 'Save kaise?', 'Kahan zyada?', 'Budget bacha?'],
    joint: ['Maine kitna?', 'Partner ne kitna?', 'Kya spending theek?', 'Save kaise?'],
  },
};

/** Map common Hinglish/Hindi suggestion chips → English (and reverse soft map). */
const HI_TO_EN: Record<string, string> = {
  'kya spending theek?': 'Is spending okay?',
  'save kaise?': 'How to save?',
  'kahan zyada?': 'Where am I overspending?',
  'budget bacha?': 'Budget left?',
  'maine kitna?': 'How much did I spend?',
  'partner ne kitna?': 'Partner spend?',
  'kisne kitna?': 'Who spent how much?',
  'is month kitna kharch?': 'How much this month?',
  'is month kitna?': 'How much this month?',
  'aaj kitna?': 'How much today?',
  'top category': 'Top category',
  'top merchant': 'Top merchant',
  'roz kitna avg?': 'Daily average?',
  'projected month?': 'Month-end projection?',
  'account wise?': 'By account?',
  '10 percent kaato': 'Cut 10 percent?',
  'sabse bada expense': 'Biggest expense',
  'food pe kitna?': 'How much on food?',
};

const EN_TO_HI: Record<string, string> = Object.fromEntries(
  Object.entries(HI_TO_EN).map(([hi, en]) => [en.toLowerCase(), hi.replace(/\?$/, '?').replace(/^./, c => c.toUpperCase())]),
);

// Fix EN_TO_HI values to proper Hindi chips
Object.assign(EN_TO_HI, {
  'is spending okay?': 'Kya spending theek?',
  'how to save?': 'Save kaise?',
  'where am i overspending?': 'Kahan zyada?',
  'budget left?': 'Budget bacha?',
  'how much did i spend?': 'Maine kitna?',
  'partner spend?': 'Partner ne kitna?',
  'who spent how much?': 'Kisne kitna?',
  'how much this month?': 'Is month kitna kharch?',
  'how much today?': 'Aaj kitna?',
  'top category': 'Top category',
  'top merchant': 'Top merchant',
  'daily average?': 'Roz kitna avg?',
  'month-end projection?': 'Projected month?',
  'by account?': 'Account wise?',
  'cut 10 percent?': '10 percent kaato',
  'biggest expense': 'Sabse bada expense',
  'how much on food?': 'Food pe kitna?',
});

export function localizeChips(chips: string[], lang: ChatLang): string[] {
  return chips.map(c => {
    const key = c.trim().toLowerCase();
    if (lang === 'en') return HI_TO_EN[key] || c;
    return EN_TO_HI[key] || c;
  });
}
