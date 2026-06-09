import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Driver } from '../driver.entity';
import {
  DriverDocumentStatus,
  DriverDocumentType,
} from '../../shared/enums/driver-document-type.enum';

/**
 * One uploaded compliance document (license, registration, insurance,
 * national ID). The driver app's Documents screen shows one of each
 * type — uploading a new one of a type that already exists replaces
 * the previous row at the service layer, so this table only ever holds
 * the current document per (driver, type) pair.
 *
 * Verification is a separate admin workflow (ops flips status to
 * VERIFIED or REJECTED); fresh uploads land as PENDING_REVIEW.
 */
@Entity('driver_documents')
@Index(['driver', 'type'])
export class DriverDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  driver: Driver;

  @Column({ type: 'enum', enum: DriverDocumentType })
  type: DriverDocumentType;

  /** Public URL (served via /uploads/driver-documents/<file>) */
  @Column()
  fileUrl: string;

  /** Original filename + size kept for the audit log; mobile UI ignores. */
  @Column({ nullable: true })
  originalFilename: string;

  @Column({ type: 'int', nullable: true })
  fileSizeBytes: number;

  @Column({ nullable: true })
  mimeType: string;

  /**
   * Document number the driver typed when uploading (license number,
   * registration plate, etc.). Stored as-is; the API caller decides
   * how to mask in the UI.
   */
  @Column({ nullable: true })
  documentNumber: string;

  @Column({ type: 'timestamp', nullable: true })
  issuedAt: Date;

  /** null = "No expiry" — used for National ID. */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({
    type: 'enum',
    enum: DriverDocumentStatus,
    default: DriverDocumentStatus.PENDING_REVIEW,
  })
  status: DriverDocumentStatus;

  /** Filled by admin when status transitions. */
  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'int', nullable: true })
  reviewedById: number;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
