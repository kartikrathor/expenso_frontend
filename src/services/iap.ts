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
export type ThemeSkus = { monthly: string; permanent: string };

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
      if (
        /NitroModules|Nitro runtime|Turbo\/Native-Module could not be found/i.test(
          raw,
        )
      ) {
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

async function verifyPurchaseOnServer(
  purchase: Purchase,
  endpoint = '/api/pro/iap/verify',
  extra: { packId?: string; consumable?: boolean } = {},
) {
  const token = useAuthStore.getState().token;
  if (!token) throw new Error('Please sign in again.');

  const purchaseToken = purchase.purchaseToken;
  if (!purchaseToken) throw new Error('Missing purchase token from store.');

  await apiRequest(endpoint, {
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
      packId: extra.packId,
    },
  });

  await finishTransaction({
    purchase,
    isConsumable: extra.consumable === true,
  });
}

function waitForPurchase(
  productId: string,
  timeoutMs = 120_000,
): Promise<Purchase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      cleanup();
      if (!settled) {
        settled = true;
        reject(
          new Error(
            'Payment timed out. If you were charged, tap Restore purchases.',
          ),
        );
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

  const product = products?.find(
    p => p.id === productId || (p as any).productId === productId,
  );
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
export async function restoreProPurchases(
  skus: ProSkus = DEFAULT_PRO_SKUS,
): Promise<boolean> {
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

export const DEFAULT_THEME_SKUS: ThemeSkus = {
  monthly: 'com.kriovent.expenso.theme.monthly',
  permanent: 'com.kriovent.expenso.theme.permanent',
};

export type StoreDisplayPrices = {
  proMonthly: string | null;
  proYearly: string | null;
  themeMonthly: string | null;
  themePermanent: string | null;
};

function productDisplayPrice(product: any): string | null {
  const raw =
    product?.displayPrice ||
    product?.localizedPrice ||
    product?.price ||
    null;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function pickProduct(products: any[] | null | undefined, productId: string) {
  return products?.find(
    p => p.id === productId || p.productId === productId,
  );
}

/** Localized prices from Google Play / App Store for the user's country. */
export async function fetchStoreDisplayPrices(opts: {
  pro: ProSkus;
  theme: ThemeSkus;
}): Promise<StoreDisplayPrices> {
  const empty: StoreDisplayPrices = {
    proMonthly: null,
    proYearly: null,
    themeMonthly: null,
    themePermanent: null,
  };
  try {
    await ensureIapConnected();
    const [subs, oneTime] = await Promise.all([
      fetchProducts({
        skus: [opts.pro.monthly, opts.pro.yearly, opts.theme.monthly].filter(
          Boolean,
        ),
        type: 'subs',
      }) as Promise<any[] | null>,
      fetchProducts({
        skus: [opts.theme.permanent].filter(Boolean),
        type: 'in-app',
      }) as Promise<any[] | null>,
    ]);
    return {
      proMonthly: productDisplayPrice(pickProduct(subs, opts.pro.monthly)),
      proYearly: productDisplayPrice(pickProduct(subs, opts.pro.yearly)),
      themeMonthly: productDisplayPrice(
        pickProduct(subs, opts.theme.monthly),
      ),
      themePermanent: productDisplayPrice(
        pickProduct(oneTime, opts.theme.permanent),
      ),
    };
  } catch (err) {
    if (__DEV__) console.warn('[IAP] fetchStoreDisplayPrices failed', err);
    return empty;
  }
}

export async function purchaseThemePack(
  kind: 'monthly' | 'permanent',
  skus: ThemeSkus,
  packId: string,
): Promise<void> {
  await ensureIapConnected();
  if (!packId) throw new Error('Theme pack is required.');
  const productId = kind === 'monthly' ? skus.monthly : skus.permanent;
  if (!productId) throw new Error('Theme store product ID is not configured.');
  const type = kind === 'monthly' ? 'subs' : 'in-app';
  const products = (await fetchProducts({ skus: [productId], type })) as
    | any[]
    | null;
  const product = products?.find(
    p => p.id === productId || p.productId === productId,
  );
  if (!product) {
    throw new Error(
      `Product “${productId}” not found. Create and publish it in the store console.`,
    );
  }
  const purchasePromise = waitForPurchase(productId);
  try {
    if (kind === 'monthly' && Platform.OS === 'android') {
      const offerToken = (product.subscriptionOffers || []).find(
        (offer: any) => offer.offerTokenAndroid,
      )?.offerTokenAndroid;
      if (!offerToken)
        throw new Error('Add a base plan for this theme in Play Console.');
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
        type: type as any,
        request:
          Platform.OS === 'android'
            ? ({ google: { skus: [productId] } } as any)
            : ({ apple: { sku: productId } } as any),
      });
    }
    const purchase = await purchasePromise;
    await verifyPurchaseOnServer(purchase, '/api/pro/themes/iap/verify', {
      packId,
      // Shared permanent product must be consumable so each theme can be bought.
      consumable: kind === 'permanent',
    });
  } catch (err: any) {
    purchasePromise.catch(() => undefined);
    // Shared monthly SKU: already subscribed → grant this pack via restore.
    const msg = String(err?.message || err || '').toLowerCase();
    if (
      kind === 'monthly' &&
      (msg.includes('already') ||
        msg.includes('owned') ||
        msg.includes('subscribed'))
    ) {
      await restoreThemePack(skus, packId);
      return;
    }
    throw err;
  }
}

export async function restoreThemePack(
  skus: ThemeSkus,
  packId: string,
): Promise<void> {
  await ensureIapConnected();
  if (!packId) throw new Error('Theme pack is required.');
  const allowed = new Set([skus.monthly, skus.permanent].filter(Boolean));
  const purchases = await getAvailablePurchases();
  const purchase = (purchases || []).find(item => allowed.has(item.productId));
  if (!purchase)
    throw new Error(
      'No theme purchase was found on this store account.',
    );
  const consumable = purchase.productId === skus.permanent;
  await verifyPurchaseOnServer(purchase, '/api/pro/themes/iap/verify', {
    packId,
    consumable,
  });
}
