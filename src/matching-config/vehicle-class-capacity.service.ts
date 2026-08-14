import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleClass } from '../shared/enums/vehicle-class.enum';
import { VehicleClassCapacity } from './vehicle-class-capacity.entity';

/**
 * Provides read access to the vehicle_class_capacity lookup and
 * seeds three default rows (sedan / suv / pickup) on first boot.
 * Existing rows are left alone on subsequent boots so ops SQL edits
 * survive redeploys.
 */

const DEFAULT_TRUNK: Record<VehicleClass, number> = {
  [VehicleClass.SEDAN]: 6,
  [VehicleClass.SUV]: 9,
  [VehicleClass.PICKUP]: 15,
};
const DEFAULT_WEIGHT: Record<VehicleClass, number> = {
  [VehicleClass.SEDAN]: 50,
  [VehicleClass.SUV]: 90,
  [VehicleClass.PICKUP]: 200,
};
const DEFAULT_SEAT_SLOT: Record<VehicleClass, number> = {
  [VehicleClass.SEDAN]: 2,
  [VehicleClass.SUV]: 3,
  [VehicleClass.PICKUP]: 3,
};

@Injectable()
export class VehicleClassCapacityService implements OnApplicationBootstrap {
  private readonly logger = new Logger(VehicleClassCapacityService.name);

  constructor(
    @InjectRepository(VehicleClassCapacity)
    private readonly repo: Repository<VehicleClassCapacity>,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.repo.count();
    if (existing > 0) return;
    const rows: VehicleClassCapacity[] = [
      this.rowFromEnv(VehicleClass.SEDAN, 'SEDAN'),
      this.rowFromEnv(VehicleClass.SUV, 'SUV'),
      this.rowFromEnv(VehicleClass.PICKUP, 'PICKUP'),
    ];
    await this.repo.save(rows);
    this.logger.log(
      `Seeded ${rows.length} vehicle_class_capacity rows (sedan/suv/pickup)`,
    );
  }

  async getCapacity(cls: VehicleClass): Promise<VehicleClassCapacity | null> {
    return this.repo.findOne({ where: { vehicleClass: cls } });
  }

  private rowFromEnv(cls: VehicleClass, prefix: string): VehicleClassCapacity {
    const row = new VehicleClassCapacity();
    row.vehicleClass = cls;
    row.trunkSlots = this.envInt(
      `VEHICLE_CAP_${prefix}_TRUNK_SLOTS`,
      DEFAULT_TRUNK[cls],
    );
    row.weightLimitKg = this.envInt(
      `VEHICLE_CAP_${prefix}_WEIGHT_KG`,
      DEFAULT_WEIGHT[cls],
    );
    row.seatSlotValue = this.envInt(
      `VEHICLE_CAP_${prefix}_SEAT_SLOT`,
      DEFAULT_SEAT_SLOT[cls],
    );
    return row;
  }

  private envInt(key: string, fallback: number): number {
    const raw = this.cfg.get<string>(key);
    if (raw == null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
}
