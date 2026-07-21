import { Column, Entity, PrimaryColumn } from 'typeorm';
import { VehicleClass } from '../shared/enums/vehicle-class.enum';

/**
 * Static-ish lookup of capacity limits per vehicle class. Seeded from
 * env vars on first boot; ops can override individual rows via SQL.
 * Referenced by the matcher when checking package fit (master spec §6.2).
 */
@Entity('vehicle_class_capacity')
export class VehicleClassCapacity {
  @PrimaryColumn({ type: 'enum', enum: VehicleClass })
  vehicleClass: VehicleClass;

  /** Number of package "slots" the trunk can hold. */
  @Column({ type: 'int' })
  trunkSlots: number;

  /** Total package weight the vehicle can safely carry. */
  @Column({ type: 'int' })
  weightLimitKg: number;

  /**
   * Slots per empty seat when the trip is packages-only. Trunk +
   * empty-seats × seatSlotValue = total available slots (§6.2).
   */
  @Column({ type: 'int' })
  seatSlotValue: number;
}
