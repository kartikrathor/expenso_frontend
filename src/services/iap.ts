import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type ProductSubscription,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { apiRequest } from './api';
import { useAuthStore } from '../store/authStore';

export const DEFAULT_PRO_SKUS = {
  monthly: 'com.kriovent.expenso.pro.monthly',
  yearly: 'com.kriovent.expenso.pro.yearly',
} as const;

type ProSkus = { monthly: string; yearly: string };

let connecting: Promise<boolean> | null = null;
let connected = false;

export async function ensureIapConnected(): Promise<boolean> {
  if (connected) return true;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      await initConnection();
      connected = true;
      return true;
    } catch (err: any) {
      connected = false;
      const raw = String(err?.message || err || '');
      if (__DEV__) console.warn('[IAP] initConnection failed', err);
      if (/NitroModules|Nitro runtime|Turbo\/Native-Module could not be found/i.test(raw)) {
        throw new Error(
          'Billing native module missing. Rebuild the app after installing react-native-nitro-modules (yarn android).',
        );
      }
      throw new Error(
        Platform.OS === 'android'
          ? 'Could not connect to Google Play Billing. Use a real device / Play build.'
          : 'Could not connect to App Store billing.',
      );
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export async function disconnectIap() {
  try {
    if (connected) await endConnection();
  } catch {
    // ignore
  } finally {
    connected = false;
  }
}

function skuForPlan(plan: 'monthly' | 'yearly', skus: ProSkus) {
  return plan === 'yearly' ? skus.yearly : skus.monthly;
}

function isUserCancel(err: any) {
  const code = String(err?.code || err?.name || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code.includes('UserCancelled') ||
    code.includes('E_USER_CANCELLED') ||
    msg.includes('cancel') ||
    msg.includes('cancelled')
  );
}

async function verifyPurchaseOnServer(purchase: Purchase) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Please sign in again.');

  const purchaseToken = purchase.purchaseToken;
  if (!purchaseToken) throw new Error('Missing purchase token from store.');

  await apiRequest('/api/pro/iap/verify', {
    method: 'POST',
    token,
    body: {
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      productId: purchase.productId,
      purchaseToken,
      transactionId: purchase.transactionId || undefined,
      packageName:
        Platform.OS === 'android'
          ? (purchase as any).packageNameAndroid || 'com.kriovent.expenso'
          : undefined,
    },
  });

  await finishTransaction({ purchase, isConsumable: false });
}

function waitForPurchase(productId: string, timeoutMs = 120_000): Promise<Purchase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      cleanup();
      if (!settled) {
        settled = true;
        reject(new Error('Payment timed out. If you were charged, tap Restore purchases.'));
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      try {
        sub.remove();
      } catch {
        /* */
      }
      try {
        errSub.remove();
      } catch {
        /* */
      }
    };

    const sub = purchaseUpdatedListener(async (purchase: Purchase) => {
      if (purchase.productId !== productId) return;
      if (settled) return;
      settled = true;
      cleanup();
      resolve(purchase);
    });

    const errSub = purchaseErrorListener((error: PurchaseError) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (isUserCancel(error)) {
        reject(new Error('Purchase cancelled'));
      } else {
        reject(new Error(error.message || 'Purchase failed'));
      }
    });
  });
}

/**
 * Launch Play Billing / App Store subscription for Pro monthly or yearly.
 * Verifies on server, then finishes the store transaction.
 */
export async function purchaseProSubscription(
  plan: 'monthly' | 'yearly',
  skus: ProSkus = DEFAULT_PRO_SKUS,
): Promise<void> {
  await ensureIapConnected();
  const productId = skuForPlan(plan, skus);

  const products = (await fetchProducts({
    skus: [productId],
    type: 'subs',
  })) as ProductSubscription[] | null;

  const product = products?.find(p => p.id === productId || (p as any).productId === productId);
  if (!product) {
    throw new Error(
      `Product “${productId}” not found in the store. Create it in Play Console / App Store Connect and publish.`,
    );
  }

  const purchasePromise = waitForPurchase(productId);

  if (Platform.OS === 'android') {
    const offers = (product as ProductSubscription).subscriptionOffers || [];
    const offerToken = offers.find(o => o.offerTokenAndroid)?.offerTokenAndroid;
    if (!offerToken) {
      throw new Error(
        'No Google Play offer token for this subscription. Add a base plan + offer in Play Console.',
      );
    }
    await requestPurchase({
      type: 'subs',
      request: {
        google: {
          skus: [productId],
          subscriptionOffers: [{ sku: productId, offerToken }],
        },
      },
    });
  } else {
    await requestPurchase({
      type: 'subs',
      request: {
        apple: { sku: productId },
      },
    });
  }

  const purchase = await purchasePromise;
  await verifyPurchaseOnServer(purchase);
}

/** Restore existing store subscriptions and re-link to this Expenso account. */
export async function restoreProPurchases(skus: ProSkus = DEFAULT_PRO_SKUS): Promise<boolean> {
  await ensureIapConnected();
  const allowed = new Set([skus.monthly, skus.yearly]);
  const purchases = await getAvailablePurchases();
  const relevant = (purchases || []).filter(p => allowed.has(p.productId));
  if (!relevant.length) {
    throw new Error('No Pro subscription found on this store account.');
  }

  // Prefer yearly if both present
  const pick =
    relevant.find(p => p.productId === skus.yearly) ||
    relevant.find(p => p.productId === skus.monthly) ||
    relevant[0];

  await verifyPurchaseOnServer(pick);
  return true;
}
