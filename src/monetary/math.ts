import * as dineroCurrencies from "@dinero.js/currencies";
import { add, convert as convertCore, dinero, multiply } from "dinero.js";
import type { Dinero, Rates } from "dinero.js";

export type CurrencyCode = keyof typeof dineroCurrencies;
export interface Currency {
  readonly code: CurrencyCode;
  readonly base: number;
  readonly exponent: number;
}

export const currencies = dineroCurrencies as Record<CurrencyCode, Currency>;

export function formatMoney(opts: {
  value: string;
  currency: { code: string };
}) {
  return Number(opts.value).toLocaleString("en-US", {
    style: "currency",
    currency: opts.currency.code,
  });
}

export function normalizeAmount(
  amount: number,
  currency: CurrencyCode = "USD",
) {
  const currencyInfo = currencies[currency];
  return amount * currencyInfo.base ** currencyInfo.exponent;
}

export const convert = (
  dineroObject: Dinero<number>,
  newCurrency: CurrencyCode,
  rates: Record<string, number>,
) => {
  // Flip the rate so that the base is in the desired base currency
  const baseCurrency = dineroObject.toJSON().currency.code as CurrencyCode;
  const properRates = {
    [newCurrency]: {
      amount: Math.round((rates[newCurrency] / rates[baseCurrency]) * 1e6),
      scale: 6,
    },
  } satisfies Rates<number>;

  return convertCore(dineroObject, currencies[newCurrency], properRates);
};

// Hoisted type without rates
type HoistedConverter = (
  arg1: Parameters<typeof convert>[0],
  arg2: Parameters<typeof convert>[1],
) => Dinero<number>;

export function sumDineros(opts: {
  dineros: Dinero<number>[];
  converter: HoistedConverter;
  currency: CurrencyCode;
}) {
  const totalRevenue = opts.dineros.reduce(
    (acc, dineroObject) => {
      return add(acc, opts.converter(dineroObject, opts.currency));
    },
    dinero({ amount: 0, currency: currencies[opts.currency] }),
  );

  return totalRevenue;
}

export function slotsToDineros(
  slots: { chargeRate: number; currency: CurrencyCode; duration: string }[],
) {
  return slots.map((s) =>
    multiply(
      dinero({ amount: s.chargeRate, currency: currencies[s.currency] }),
      +s.duration,
    ),
  );
}