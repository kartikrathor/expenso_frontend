# ExpenseWise 💸

Smart expense management app — voice se Hindi/English mein bolo ya type karke save karo. 100% free, fully offline.

## Features

- **Voice Entry** — Hindi ya English mein bolo: *"Blinkit me 200 rupaye"*
- **Manual Entry** — Amount, merchant, category type karke add karo
- **Smart Merchant Detection** — Blinkit, Zepto, Amazon, Flipkart, Swiggy, Zomato + more
- **Brand Icons** — Har merchant ka apna colored icon
- **Beautiful Analytics** — Pie chart, bar charts, daily spending, smart insights
- **Smooth Animations** — Reanimated powered UI transitions
- **100% Free** — No API keys, no cloud, no subscriptions. AsyncStorage pe local save

## Tech Stack

- React Native 0.86 (Bare Workflow)
- TypeScript
- Zustand + AsyncStorage
- React Navigation
- Reanimated 3 + Gesture Handler
- react-native-gifted-charts
- @react-native-voice/voice (device native speech)

## Setup

```bash
cd ExpenseWise
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

## Voice Examples

| Hindi | English |
|-------|---------|
| Blinkit me 200 rupaye | Spent 200 on Blinkit |
| Amazon par 1500 rs | 500 rupees on Amazon |
| Zepto se 350 | Paid 350 for Zepto |

## Project Structure

```
src/
  components/   # UI components (VoiceButton, ExpenseCard, etc.)
  constants/    # Theme, merchants, categories
  navigation/   # Tab navigator
  screens/      # Home, Analytics, History
  store/        # Zustand expense store
  types/        # TypeScript types
  utils/        # Expense parser (Hindi + English)
```

## Permissions

- **Microphone** — Voice expense entry
- **Speech Recognition** — iOS speech-to-text

---

Made with ❤️ — ExpenseWise
