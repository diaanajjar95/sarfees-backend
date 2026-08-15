/**
 * Driver wallet ledger entry kinds.
 *
 * Amounts on wallet_transactions are SIGNED: credits are positive,
 * `commission` rows are negative. `adjustment` may be either sign —
 * it exists for ops corrections.
 */
export enum WalletTransactionType {
  /** Prepaid top-up card redeemed by a seller for this driver. */
  CARD_TOPUP = 'card_topup',
  /** Manual credit by super admin / finance. */
  ADMIN_CREDIT = 'admin_credit',
  /** Refund owed to the driver — always lands on the wallet. */
  REFUND = 'refund',
  /** Platform commission deducted at trip completion (negative). */
  COMMISSION = 'commission',
  /** Ops correction, either sign. */
  ADJUSTMENT = 'adjustment',
}

export enum TopupCardStatus {
  AVAILABLE = 'available',
  REDEEMED = 'redeemed',
  VOID = 'void',
}
