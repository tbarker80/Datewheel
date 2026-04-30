import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const PRO_PRODUCT_ID = Platform.OS === 'ios' ? 'DateWheelPro' : 'pro_upgrade';
const PRO_STORAGE_KEY = 'is_pro_user';

function isPurchaseValid(purchase: any): boolean {
  return purchase?.purchaseState === 'purchased' && !!purchase?.purchaseToken;
}

function isIapUnavailable(e: any): boolean {
  const code = e?.code ?? '';
  const msg = e?.message ?? '';
  return code === 'iap-not-available' || msg.includes('iap-not-available') || msg.includes('NitroModules');
}

interface ProContextType {
  isPro: boolean;
  isLoading: boolean;
  purchasePro: () => Promise<void>;
  restorePurchase: () => Promise<void>;
  grantProAlreadyPaid: () => Promise<void>;
  price: string;
}

const ProContext = createContext<ProContextType>({
  isPro: false,
  isLoading: true,
  purchasePro: async () => {},
  restorePurchase: async () => {},
  grantProAlreadyPaid: async () => {},
  price: '$2.99',
});

export function useProStatus() {
  return useContext(ProContext);
}

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [price, setPrice] = useState('$2.99');
  const purchaseListenerRef = useRef<any>(null);
  const errorListenerRef = useRef<any>(null);

  useEffect(() => {
    loadProStatus();
    setupIAP();
    return () => {
      purchaseListenerRef.current?.remove();
      errorListenerRef.current?.remove();
      import('expo-iap').then(iap => {
        iap.endConnection().catch(() => {});
      });
    };
  }, []);

  async function loadProStatus() {
    try {
      const stored = await AsyncStorage.getItem(PRO_STORAGE_KEY);
      if (stored === 'true') setIsPro(true);
    } catch (e) {
      console.warn('Failed to load Pro status:', e);
    }
    setIsLoading(false);
  }

  async function setupIAP() {
    try {
      const iap = await import('expo-iap');
      await iap.initConnection();

      // Purchase update listener — required for iOS to complete transactions
      purchaseListenerRef.current = iap.purchaseUpdatedListener(async (purchase: any) => {
        if (isPurchaseValid(purchase)) {
          await grantPro();
          await iap.finishTransaction({ purchase, isConsumable: false });
        }
      });

      // Purchase error listener
      errorListenerRef.current = iap.purchaseErrorListener((error: any) => {
        console.warn('Purchase error:', error);
      });

      // Fetch product price
      const products = await iap.fetchProducts({ skus: [PRO_PRODUCT_ID] });
      if (products && products.length > 0) {
        const p = products[0] as any;
        setPrice(p.localizedPrice || p.formattedPrice || '$2.99');
      }
    } catch (e: any) {
      console.log('IAP not available:', e?.message);
    }
  }

  async function grantPro() {
    setIsPro(true);
    await AsyncStorage.setItem(PRO_STORAGE_KEY, 'true');
  }

  async function purchasePro() {
    try {
      const iap = await import('expo-iap');
      await iap.requestPurchase({
        type: 'in-app',
        request: Platform.OS === 'ios'
          ? { apple: { sku: PRO_PRODUCT_ID } }
          : { google: { skus: [PRO_PRODUCT_ID] } },
      });
      // Purchase completion is handled by purchaseUpdatedListener above
    } catch (e: any) {
      if (e?.code === 'user-cancelled') return;
      // Expo Go / simulator: IAP module unavailable, grant Pro for UI testing
      if (isIapUnavailable(e)) {
        await grantPro();
        return;
      }
      throw e;
    }
  }

  async function restorePurchase() {
    try {
      const iap = await import('expo-iap');
      const purchases = await iap.getAvailablePurchases();
      const proPurchase = purchases.find((p: any) => p.productId === PRO_PRODUCT_ID);
      if (proPurchase) {
        await grantPro();
        return;
      }
      throw new Error('No Pro purchase found');
    } catch (e: any) {
      if (e?.message === 'No Pro purchase found') throw e;
      if (isIapUnavailable(e)) {
        throw new Error('Purchase restore not available in Expo Go');
      }
      throw e;
    }
  }

  async function grantProAlreadyPaid() {
    await grantPro();
  }

  return (
    <ProContext.Provider value={{ isPro, isLoading, purchasePro, restorePurchase, grantProAlreadyPaid, price }}>
      {children}
    </ProContext.Provider>
  );
}
