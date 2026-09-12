import type {
  MoneyValue,
} from '../types/api';

export function toNumber(
  value: MoneyValue,
): number {
  return Number(value);
}

export function formatCurrency(
  value: MoneyValue,
  currency = 'BRL',
): string {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency,
    },
  ).format(
    toNumber(value),
  );
}

export function formatPercentage(
  value:
    | MoneyValue
    | null,
): string {
  if (value === null) {
    return '—';
  }

  return `${toNumber(value).toFixed(1)}%`;
}

export function formatDate(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(
    new Date(value),
  );
}