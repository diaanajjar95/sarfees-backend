export enum PassengerNotificationType {
  // Trip lifecycle
  REQUEST_MATCHED = 'request_matched',
  DRIVER_EN_ROUTE = 'driver_en_route',
  DRIVER_ARRIVED = 'driver_arrived',
  TRIP_STARTED = 'trip_started',
  TRIP_COMPLETED = 'trip_completed',
  TRIP_CANCELLED = 'trip_cancelled',

  // Package lifecycle (passenger-as-sender)
  PACKAGE_PICKED_UP = 'package_picked_up',
  PACKAGE_DELIVERED = 'package_delivered',
  PACKAGE_CANCELLED = 'package_cancelled',

  // Catch-all
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}

export enum PassengerNotificationCategory {
  TRIPS = 'trips',
  PACKAGES = 'packages',
  SYSTEM = 'system',
}

/** Map a notification type to the high-level category used by the filter tabs. */
export const PASSENGER_NOTIFICATION_CATEGORY: Record<
  PassengerNotificationType,
  PassengerNotificationCategory
> = {
  [PassengerNotificationType.REQUEST_MATCHED]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.DRIVER_EN_ROUTE]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.DRIVER_ARRIVED]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.TRIP_STARTED]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.TRIP_COMPLETED]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.TRIP_CANCELLED]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.PACKAGE_PICKED_UP]:
    PassengerNotificationCategory.PACKAGES,
  [PassengerNotificationType.PACKAGE_DELIVERED]:
    PassengerNotificationCategory.PACKAGES,
  [PassengerNotificationType.PACKAGE_CANCELLED]:
    PassengerNotificationCategory.PACKAGES,
  [PassengerNotificationType.SYSTEM_ANNOUNCEMENT]:
    PassengerNotificationCategory.SYSTEM,
};
