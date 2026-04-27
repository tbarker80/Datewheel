import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const PRO_PRODUCT_ID = Platform.OS === 'ios' ? 'DateWheelPro' : 'pro_upgrade';
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
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [price, setPrice] = useState('$2.99');
  const purchaseListenerRef = useRef<any>(null);
  const errorListenerRef = useRef<any>(null);

  useEffect(() => {
    loadProStatus();
    setupIAP();
    return () => {
      // Clean up listeners on unmount
      purchaseListenerRef.current?.remove();
      errorListenerRef.current?.remove();
      import('react-native-iap').then(iap => {
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
      const iap = await import('react-native-iap');
      await iap.initConnection();

      // Purchase update listener — required for iOS to complete transactions
      purchaseListenerRef.current = iap.purchaseUpdatedListener(async (purchase: any) => {
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          await grantPro();
          // Finish the transaction — required on iOS
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
      if (Platform.OS === 'ios') {
  await iap.requestPurchase({ 
    sku: PRO_PRODUCT_ID,
    andDangerouslyFinishTransactionAutomaticallyIOS: false 
  } as any);
} else {
  await iap.requestPurchase({ skus: [PRO_PRODUCT_ID] } as any);
}
      // Purchase completion is handled by purchaseUpdatedListener above
    } catch (e: any) {
      if (e?.code === 'E_USER_CANCELLED') return;
      // Only grant Pro in Expo Go for UI testing
      if (e?.message?.includes('NitroModules')) {
        await grantPro();
        return;
      }
      throw e;
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
      if (e?.message?.includes('NitroModules')) {
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