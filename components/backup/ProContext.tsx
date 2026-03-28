import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const PRO_PRODUCT_ID = 'pro_upgrade';
const PRO_STORAGE_KEY = 'is_pro_user';

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
  const [isPro, setIsPro] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [price, setPrice] = useState('$2.99');

  useEffect(() => {
    loadProStatus();
    setupIAP();
  }, []);

  async function loadProStatus() {
    try {
      const stored = await AsyncStorage.getItem(PRO_STORAGE_KEY);
      if (stored === 'true') setIsPro(true);
    } catch (e) {}
    setIsLoading(false);
  }

  async function setupIAP() {
    try {
      // Lazy import to avoid native module crash in Expo Go
      const iap = await import('react-native-iap');
      await iap.initConnection();
      const products = await iap.fetchProducts({ skus: [PRO_PRODUCT_ID] });
      if (products && products.length > 0) {
        const p = products[0] as any;
        setPrice(p.localizedPrice || '$2.99');
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
      const iap = await import('react-native-iap');
      await iap.requestPurchase({ skus: [PRO_PRODUCT_ID] } as any);
      await grantPro();
    } catch (e: any) {
      if (e?.code !== 'E_USER_CANCELLED') {
        // In Expo Go native modules aren't available — grant Pro for UI testing
        if (e?.message?.includes('NitroModules') || e?.message?.includes('native') || e?.message?.includes('null')) {
          await grantPro();
          return;
        }
        throw e;
      }
    }
  }

  async function restorePurchase() {
    try {
      const iap = await import('react-native-iap');
      const purchases = await iap.getAvailablePurchases();
      const proPurchase = purchases.find((p: any) => p.productId === PRO_PRODUCT_ID);
      if (proPurchase) {
        await grantPro();
        return;
      }
      throw new Error('No Pro purchase found');
    } catch (e: any) {
      if (e?.message?.includes('NitroModules') || e?.message?.includes('native') || e?.message?.includes('null')) {
        throw new Error('Purchase restore not available in Expo Go');
      }
      throw e;
    }
  }

  async function grantProAlreadyPaid() {
    await grantPro();
  }

  return (
    <ProContext.Provider value={{
      isPro,
      isLoading,
      purchasePro,
      restorePurchase,
      grantProAlreadyPaid,
      price,
    }}>
      {children}
    </ProContext.Provider>
  );
}