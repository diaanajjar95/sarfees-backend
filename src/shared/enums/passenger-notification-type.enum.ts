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

  // Matcher lifecycle (master spec §11 + §13)
  TRIP_FROZEN = 'trip_frozen',
  TRIP_ASSIGNED = 'trip_assigned',
  /**
   * A women-only trip landed on a male driver because no female
   * accepted through cascade + broadcast (§7). Passenger may cancel
   * without a fee.
   */
  WOMEN_ONLY_MALE_DRIVER_FALLBACK = 'women_only_male_driver_fallback',
  /**
   * Group hit UNSERVED_ESCALATION — no driver by departure. Ops is
   * on it; passenger is told about the delay (§9.7).
   */
  TRIP_DELAY_ESCALATION = 'trip_delay_escalation',

  // Catch-all
  /** Trip done — nudge the passenger to rate their driver (optional). */
  RATE_YOUR_TRIP = 'rate_your_trip',
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
  [PassengerNotificationType.TRIP_FROZEN]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.TRIP_ASSIGNED]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.WOMEN_ONLY_MALE_DRIVER_FALLBACK]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.TRIP_DELAY_ESCALATION]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.RATE_YOUR_TRIP]:
    PassengerNotificationCategory.TRIPS,
  [PassengerNotificationType.SYSTEM_ANNOUNCEMENT]:
    PassengerNotificationCategory.SYSTEM,
};
