
export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: 'READY FOR PAYOUT',
  approved: 'APPROVED',
  paid: 'PAID',
};

export const getOriginalAmount = (payout: any) => {
  if (!payout) return 0;
  return Number(payout.original_amount ?? payout.amount_net ?? 0);
};

export const getSettlementAmount = (payout: any) => {
  if (!payout) return 0;
  // Fallback order: adjusted_amount -> amount_net -> original_amount -> 0
  if (payout.adjusted_amount !== null && payout.adjusted_amount !== undefined) {
    return Number(payout.adjusted_amount);
  }
  if (payout.amount_net !== null && payout.amount_net !== undefined) {
    return Number(payout.amount_net);
  }
  return Number(payout.original_amount ?? 0);
};

export const getPayableAmount = (payout: any) => {
  return getSettlementAmount(payout);
};

export const filterPayouts = (payouts: any[], searchTerm: string, fields: string[]) => {
  if (!searchTerm) return payouts;
  const lowerTerm = searchTerm.toLowerCase();
  return payouts.filter(p => 
    fields.some(field => {
      const value = p[field];
      return value && String(value).toLowerCase().includes(lowerTerm);
    })
  );
};
