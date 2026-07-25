export enum StopPackageStatus {
  PENDING = 'pending',
  COLLECTED = 'collected',
  /** Sender no-show — package wasn't there to collect (§6.7). */
  NOT_FOUND = 'not_found',
  /** Driver exercised the refusal right at pickup (§6.4). */
  REFUSED = 'refused',
  DELIVERED = 'delivered',
  DELIVERY_FAILED = 'delivery_failed',
}

/**
 * Why the driver refused a package at pickup (§6.4). Refusals are
 * logged, the sender is not charged, and they NEVER touch the
 * driver's decline-penalty counters.
 */
export enum PackageRefusalReason {
  NOT_AS_DECLARED = 'not_as_declared',
  SUSPICIOUS = 'suspicious',
  PROHIBITED_ITEM = 'prohibited_item',
  OVERSIZED = 'oversized',
  OTHER = 'other',
}

export enum StopPackageRole {
  COLLECTING = 'collecting',
  DELIVERING = 'delivering',
}

export enum DeliveryFailureReason {
  RECEIVER_NOT_REACHABLE = 'receiver_not_reachable',
  ADDRESS_NOT_FOUND = 'address_not_found',
  RECEIVER_REFUSED = 'receiver_refused',
  OTHER = 'other',
}
