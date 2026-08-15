export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  OPS_MANAGER = 'ops_manager',
  SUPPORT = 'support',
  FINANCE = 'finance',
  /**
   * Prepaid-card distributor. Sees only the Cards surface: generates
   * top-up card batches and redeems them onto driver wallets by phone
   * number. No access to trips, drivers, earnings, or config.
   */
  SELLER = 'seller',
}
