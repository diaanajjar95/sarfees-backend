export enum StopPackageStatus {
  PENDING = 'pending',
  COLLECTED = 'collected',
  NOT_FOUND = 'not_found',
  DELIVERED = 'delivered',
  DELIVERY_FAILED = 'delivery_failed',
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
