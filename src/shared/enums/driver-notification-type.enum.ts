export enum DriverNotificationType {
  TRIP_ASSIGNED = 'trip_assigned',
  TRIP_REMINDER = 'trip_reminder',
  TRIP_UPDATED = 'trip_updated',
  PASSENGER_CANCELLED = 'passenger_cancelled',
  EARNINGS_RECORDED = 'earnings_recorded',
  OUTSTANDING_BALANCE = 'outstanding_balance',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

export enum DriverNotificationCategory {
  TRIPS = 'trips',
  EARNINGS = 'earnings',
  SYSTEM = 'system',
}

/** Map a notification type to the high-level category used by the filter tabs. */
export const NOTIFICATION_CATEGORY: Record<
  DriverNotificationType,
  DriverNotificationCategory
> = {
  [DriverNotificationType.TRIP_ASSIGNED]: DriverNotificationCategory.TRIPS,
  [DriverNotificationType.TRIP_REMINDER]: DriverNotificationCategory.TRIPS,
  [DriverNotificationType.TRIP_UPDATED]: DriverNotificationCategory.TRIPS,
  [DriverNotificationType.PASSENGER_CANCELLED]:
    DriverNotificationCategory.TRIPS,
  [DriverNotificationType.EARNINGS_RECORDED]:
    DriverNotificationCategory.EARNINGS,
  [DriverNotificationType.OUTSTANDING_BALANCE]:
    DriverNotificationCategory.EARNINGS,
  [DriverNotificationType.SYSTEM_ANNOUNCEMENT]:
    DriverNotificationCategory.SYSTEM,
};
