import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cities')
export class City {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nameEn: string;

  @Column({ unique: true })
  nameAr: string;

  // ─── Geometry (populated by seed script; nullable so existing rows survive) ─
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  centerLat: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  centerLng: string | null;

  /**
   * The city's outbound highway gate toward the corridor destination.
   * Pickup ordering sorts by descending distance from this point per
   * master spec §5.2 "farthest-from-city-exit-gate to nearest".
   */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  exitGateLat: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  exitGateLng: string | null;

  /** Per-city override for matching_config.defaultServiceRadiusMeters. */
  @Column({ type: 'int', nullable: true })
  serviceRadiusMeters: number | null;
}
