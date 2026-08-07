# Expenso Pro — In-app purchases

Users can unlock Pro **only after a real store payment**. Free `/api/pro/subscribe` is disabled (`410 IAP_REQUIRED`). Admins can still grant Pro from **Users → Change plan**.

## Product IDs (defaults)

| Plan | SKU |
|------|-----|
| Monthly | `com.kriovent.expenso.pro.monthly` |
| Yearly | `com.kriovent.expenso.pro.yearly` |

Change them in Admin → **Pro plans** → Store product IDs.

## Google Play Console

1. Create **subscription** products with the SKUs above (base plans: monthly / yearly).
2. Link a **service account** with permission to access the Android Publisher API.
3. On the backend `.env`:

```env
GOOGLE_PLAY_PACKAGE_NAME=com.kriovent.expenso
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

4. Install a **release / internal testing** build signed with the Play upload key (Play Billing does not work in plain debug emulator without license testers).

## App rebuild

`react-native-iap` + `react-native-nitro-modules` need a native rebuild:

```bash
cd expenso_frontend
npm install
cd android && ./gradlew clean && cd ..
npm run android
```

## Dev testing without Play verify

Only for local backend testing (never on production):

```env
IAP_SKIP_VERIFY=true
```

The client still opens the real Play purchase sheet when products exist; the server skips Google API validation.

## Flow

1. Paywall → Google Play / App Store purchase sheet  
2. App sends `purchaseToken` to `POST /api/pro/iap/verify`  
3. Server verifies with Google → activates Pro + stores `ProPurchase`  
4. **Restore purchases** re-links an existing store subscription to the signed-in account  

## Themes (shared products)

All paid themes share **two** store products (display ₹14 / ₹49):

| Kind | Product ID | Play type |
|------|------------|-----------|
| Monthly | `com.kriovent.expenso.theme.monthly` | Subscription |
| One-time | `com.kriovent.expenso.theme.permanent` | **Consumable** in-app product |

The app sends `packId` with verify so the server unlocks the selected theme.
Permanent **must** be consumable so users can buy more than one theme.
