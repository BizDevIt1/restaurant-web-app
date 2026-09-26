import { useState, useEffect, useCallback } from "react";

export type SupportedCurrency = "USD" | "PKR";

export interface CurrencyConfig {
  currency: SupportedCurrency;
  symbol: string;
  rate: number; // 1 for USD, e.g. 277.35 for PKR
}

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";
export const DEFAULT_SYMBOL = "$";
export const DEFAULT_USD_TO_PKR_RATE = 277.35;

export const STORAGE_KEY_CURRENCY = "sa_platform_currency";
export const STORAGE_KEY_SYMBOL = "sa_platform_currency_symbol";
export const STORAGE_KEY_RATE = "sa_platform_usd_to_pkr_rate";
export const STORAGE_KEY_RATE_TIME = "sa_platform_rate_time";

const BROADCAST_CHANNEL = "omni_currency_sync";
export const CURRENCY_EVENT = "sa_currency_updated";

/**
 * Fetches the live USD to PKR exchange rate from open currency APIs with cached fallback.
 */
export async function fetchLiveExchangeRate(): Promise<number> {
  if (typeof window === "undefined") return DEFAULT_USD_TO_PKR_RATE;

  // 1. Check local cache (valid for 1 hour)
  try {
    const cachedRate = localStorage.getItem(STORAGE_KEY_RATE);
    const cachedTime = localStorage.getItem(STORAGE_KEY_RATE_TIME);
    if (cachedRate && cachedTime && Date.now() - Number(cachedTime) < 3600000) {
      const rateNum = parseFloat(cachedRate);
      if (!isNaN(rateNum) && rateNum > 100) return rateNum;
    }
  } catch {}

  // 2. Fetch from Primary Open API
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const data = await res.json();
      const pkr = data?.rates?.PKR;
      if (typeof pkr === "number" && pkr > 100) {
        localStorage.setItem(STORAGE_KEY_RATE, String(pkr));
        localStorage.setItem(STORAGE_KEY_RATE_TIME, String(Date.now()));
        return pkr;
      }
    }
  } catch {}

  // 3. Fetch from Secondary Open API
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (res.ok) {
      const data = await res.json();
      const pkr = data?.rates?.PKR;
      if (typeof pkr === "number" && pkr > 100) {
        localStorage.setItem(STORAGE_KEY_RATE, String(pkr));
        localStorage.setItem(STORAGE_KEY_RATE_TIME, String(Date.now()));
        return pkr;
      }
    }
  } catch {}

  return DEFAULT_USD_TO_PKR_RATE;
}

/**
 * Reads the currently active currency configuration from localStorage.
 */
export function getPlatformCurrency(): CurrencyConfig {
  if (typeof window === "undefined") {
    return { currency: DEFAULT_CURRENCY, symbol: DEFAULT_SYMBOL, rate: 1 };
  }
  try {
    const rawCur = localStorage.getItem(STORAGE_KEY_CURRENCY);
    const rawSym = localStorage.getItem(STORAGE_KEY_SYMBOL);
    const rawRate = localStorage.getItem(STORAGE_KEY_RATE);

    const currency: SupportedCurrency = rawCur === "PKR" || rawCur === "USD" ? rawCur : DEFAULT_CURRENCY;
    const symbol = rawSym || (currency === "PKR" ? "Rs." : "$");
    const rate = currency === "PKR"
      ? (rawRate ? parseFloat(rawRate) || DEFAULT_USD_TO_PKR_RATE : DEFAULT_USD_TO_PKR_RATE)
      : 1;

    return { currency, symbol, rate };
  } catch {
    return { currency: DEFAULT_CURRENCY, symbol: DEFAULT_SYMBOL, rate: 1 };
  }
}

/**
 * Formats a base numeric price (in USD) or raw string with the active currency symbol and live conversion rate.
 * Example:
 *  - 29 with USD ("$") -> "$29"
 *  - 29 with PKR ("Rs." & rate 277.35) -> "Rs. 8,043"
 */
export function formatCurrencyPrice(
  amount: number | string | null | undefined,
  customSymbol?: string,
  customRate?: number
): string {
  const num = typeof amount === "number"
    ? amount
    : parseInt(String(amount || 0).replace(/[^0-9]/g, ""), 10) || 0;

  const config = getPlatformCurrency();
  const sym = customSymbol !== undefined ? customSymbol : config.symbol;
  const rate = customRate !== undefined
    ? customRate
    : (config.currency === "PKR" ? config.rate : 1);

  const finalAmount = config.currency === "PKR" && rate > 1
    ? Math.round(num * rate)
    : num;

  const separator = sym.endsWith(".") || sym.length > 1 ? " " : "";
  return `${sym}${separator}${finalAmount.toLocaleString()}`;
}

/**
 * Broadcasts currency changes to all components and browser tabs in real time.
 */
export function broadcastCurrencyUpdate(currency: SupportedCurrency, symbol: string, rate?: number) {
  if (typeof window === "undefined") return;
  try {
    const effectiveRate = rate !== undefined
      ? rate
      : (currency === "PKR" ? (parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || "") || DEFAULT_USD_TO_PKR_RATE) : 1);

    localStorage.setItem(STORAGE_KEY_CURRENCY, currency);
    localStorage.setItem(STORAGE_KEY_SYMBOL, symbol);
    if (currency === "PKR" && effectiveRate > 1) {
      localStorage.setItem(STORAGE_KEY_RATE, String(effectiveRate));
    }

    // 1. Same-tab CustomEvent & Cross-tab Broadcast
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(CURRENCY_EVENT, {
          detail: { currency, symbol, rate: effectiveRate },
        })
      );

      // 2. Cross-tab BroadcastChannel
      if ("BroadcastChannel" in window) {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL);
        bc.postMessage({ type: "CURRENCY_UPDATED", currency, symbol, rate: effectiveRate });
        bc.close();
      }
    }, 0);
  } catch (e) {
    console.warn("broadcastCurrencyUpdate error:", e);
  }
}

/**
 * React Hook for real-time reactivity to currency changes and live exchange rate across the whole app.
 */
export function usePlatformCurrency() {
  const [config, setConfig] = useState<CurrencyConfig>(() => getPlatformCurrency());

  useEffect(() => {
    // Initial sync
    setConfig(getPlatformCurrency());

    // Fetch latest live rate in background to keep it up-to-date
    fetchLiveExchangeRate().then((liveRate) => {
      setConfig((prev) => {
        if (prev.currency === "PKR" && Math.abs(prev.rate - liveRate) > 0.01) {
          return { ...prev, rate: liveRate };
        }
        return prev;
      });
    });

    // Listen to same-tab events
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ currency?: SupportedCurrency; symbol?: string; rate?: number }>;
      if (customEvent.detail && customEvent.detail.currency) {
        const cur = customEvent.detail.currency;
        const sym = customEvent.detail.symbol || (cur === "PKR" ? "Rs." : "$");
        const rate = customEvent.detail.rate || (cur === "PKR" ? DEFAULT_USD_TO_PKR_RATE : 1);
        setConfig({ currency: cur, symbol: sym, rate });
      } else {
        setConfig(getPlatformCurrency());
      }
    };

    // Listen to cross-tab storage changes
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEY_CURRENCY ||
        e.key === STORAGE_KEY_SYMBOL ||
        e.key === STORAGE_KEY_RATE
      ) {
        setConfig(getPlatformCurrency());
      }
    };

    // Listen to BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel(BROADCAST_CHANNEL);
        bc.onmessage = (event) => {
          if (event.data?.type === "CURRENCY_UPDATED") {
            const cur: SupportedCurrency = event.data.currency || DEFAULT_CURRENCY;
            const sym: string = event.data.symbol || (cur === "PKR" ? "Rs." : "$");
            const rate: number = event.data.rate || (cur === "PKR" ? DEFAULT_USD_TO_PKR_RATE : 1);
            setConfig({ currency: cur, symbol: sym, rate });
          }
        };
      } catch {}
    }

    window.addEventListener(CURRENCY_EVENT, handleCustomEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener(CURRENCY_EVENT, handleCustomEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const formatPrice = useCallback(
    (amount: number | string | null | undefined) => {
      const num = typeof amount === "number"
        ? amount
        : parseInt(String(amount || 0).replace(/[^0-9]/g, ""), 10) || 0;

      const finalAmount = config.currency === "PKR" && config.rate > 1
        ? Math.round(num * config.rate)
        : num;

      const sym = config.symbol;
      const separator = sym.endsWith(".") || sym.length > 1 ? " " : "";
      return `${sym}${separator}${finalAmount.toLocaleString()}`;
    },
    [config.currency, config.symbol, config.rate]
  );

  const convertPrice = useCallback(
    (amount: number | string | null | undefined) => {
      const num = typeof amount === "number"
        ? amount
        : parseInt(String(amount || 0).replace(/[^0-9]/g, ""), 10) || 0;
      return config.currency === "PKR" && config.rate > 1
        ? Math.round(num * config.rate)
        : num;
    },
    [config.currency, config.rate]
  );

  return {
    currency: config.currency,
    symbol: config.symbol,
    rate: config.rate,
    formatPrice,
    convertPrice,
  };
}
