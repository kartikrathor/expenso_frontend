import { CategoryId, MerchantId } from '../types/expense';

export interface MerchantConfig {
  id: MerchantId;
  label: string;
  keywords: string[];
  category: CategoryId;
  color: string;
  bgColor: string;
  iconLetter: string;
}

export const MERCHANTS: MerchantConfig[] = [
  {
    id: 'blinkit',
    label: 'Blinkit',
    keywords: ['blinkit', 'blink it', 'ब्लिंकिट', 'ब्लिंक इट'],
    category: 'groceries',
    color: '#F8E71C',
    bgColor: '#1A3A2A',
    iconLetter: 'B',
  },
  {
    id: 'zepto',
    label: 'Zepto',
    keywords: ['zepto', 'ज़ेप्टो', 'जेप्टो'],
    category: 'groceries',
    color: '#7B2DFF',
    bgColor: '#2A1A4A',
    iconLetter: 'Z',
  },
  {
    id: 'amazon',
    label: 'Amazon',
    keywords: ['amazon', 'amzn', 'अमेज़न', 'अमेजन'],
    category: 'shopping',
    color: '#FF9900',
    bgColor: '#2A2010',
    iconLetter: 'a',
  },
  {
    id: 'flipkart',
    label: 'Flipkart',
    keywords: ['flipkart', 'flip kart', 'फ्लिपकार्ट'],
    category: 'shopping',
    color: '#2874F0',
    bgColor: '#102040',
    iconLetter: 'F',
  },
  {
    id: 'swiggy',
    label: 'Swiggy',
    keywords: ['swiggy', 'स्विगी'],
    category: 'food',
    color: '#FC8019',
    bgColor: '#3A2010',
    iconLetter: 'S',
  },
  {
    id: 'zomato',
    label: 'Zomato',
    keywords: ['zomato', 'ज़ोमैटो', 'जोमैटो'],
    category: 'food',
    color: '#E23744',
    bgColor: '#3A1018',
    iconLetter: 'Z',
  },
  {
    id: 'myntra',
    label: 'Myntra',
    keywords: ['myntra', 'मिंत्रा'],
    category: 'shopping',
    color: '#FF3F6C',
    bgColor: '#3A1020',
    iconLetter: 'M',
  },
  {
    id: 'uber',
    label: 'Uber',
    keywords: ['uber', 'उबर'],
    category: 'transport',
    color: '#FFFFFF',
    bgColor: '#1A1A1A',
    iconLetter: 'U',
  },
  {
    id: 'ola',
    label: 'Ola',
    keywords: ['ola', 'ओला'],
    category: 'transport',
    color: '#4CAF50',
    bgColor: '#1A3A1A',
    iconLetter: 'O',
  },
  {
    id: 'netflix',
    label: 'Netflix',
    keywords: ['netflix', 'नेटफ्लिक्स'],
    category: 'entertainment',
    color: '#E50914',
    bgColor: '#3A0A0A',
    iconLetter: 'N',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    keywords: ['spotify', 'स्पॉटिफाई'],
    category: 'entertainment',
    color: '#1DB954',
    bgColor: '#0A2A14',
    iconLetter: '♪',
  },
  {
    id: 'paytm',
    label: 'Paytm',
    keywords: ['paytm', 'पेटीएम'],
    category: 'bills',
    color: '#00BAF2',
    bgColor: '#0A2840',
    iconLetter: 'P',
  },
  {
    id: 'phonepe',
    label: 'PhonePe',
    keywords: ['phonepe', 'phone pe', 'फोनपे'],
    category: 'bills',
    color: '#5F259F',
    bgColor: '#201040',
    iconLetter: 'Pe',
  },
];

export const DEFAULT_MERCHANT: MerchantConfig = {
  id: 'default',
  label: 'Other',
  keywords: [],
  category: 'other',
  color: '#A0A0B8',
  bgColor: '#252538',
  iconLetter: '₹',
};

export function getMerchantConfig(id: MerchantId): MerchantConfig {
  return MERCHANTS.find(m => m.id === id) ?? DEFAULT_MERCHANT;
}
