import type { TableKind } from './types';

export const KIND_LABEL: Record<TableKind, { label: string; hint: string }> = {
  thing: { label: 'Things', hint: 'The nouns of the business: customers, products, stores' },
  event: { label: 'Events', hint: 'What happens: orders, payments, visits. Most KPIs live here' },
  lookup: { label: 'Lookups', hint: 'Reference lists: codes, types, statuses' },
  link: { label: 'Links', hint: 'Tables that join two things together' },
};
