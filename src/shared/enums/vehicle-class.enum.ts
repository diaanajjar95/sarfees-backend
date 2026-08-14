/**
 * Broad vehicle categories used to look up trunk slot + weight
 * capacity for the matching engine (master spec §6.2, §14).
 * Persisted on Driver.vehicleClass; capacity values live in the
 * `vehicle_class_capacity` lookup table, admin-editable via SQL.
 */
export enum VehicleClass {
  SEDAN = 'sedan',
  SUV = 'suv',
  PICKUP = 'pickup',
}
