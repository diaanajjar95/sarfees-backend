export enum StopPassengerStatus {
  PENDING = 'pending',
  PICKED_UP = 'picked_up',
  NO_SHOW = 'no_show',
  DROPPED_OFF = 'dropped_off',
  CASH_NOT_COLLECTED = 'cash_not_collected',
  CANCELLED = 'cancelled',
}

export enum StopPassengerRole {
  BOARDING = 'boarding',
  ALIGHTING = 'alighting',
}
