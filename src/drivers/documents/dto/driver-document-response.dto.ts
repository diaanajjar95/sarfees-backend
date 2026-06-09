import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DriverDocumentDisplayStatus,
  DriverDocumentStatus,
  DriverDocumentType,
} from '../../../shared/enums/driver-document-type.enum';

export class DriverDocumentDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverDocumentType }) type: DriverDocumentType;
  @ApiProperty({ description: 'Public URL of the uploaded file.' })
  fileUrl: string;
  @ApiProperty({ enum: DriverDocumentStatus })
  status: DriverDocumentStatus;
  /**
   * UI-ready status the client renders directly. Combines `status`
   * and `expiresAt` so the mobile app doesn't have to do date math:
   *
   *   PENDING_REVIEW            → status is still pending
   *   REJECTED                  → admin rejected the document
   *   EXPIRED                   → past `expiresAt`
   *   EXPIRING_SOON             → verified, within 30 days of expiry
   *   VERIFIED                  → verified, plenty of time
   */
  @ApiProperty({ enum: DriverDocumentDisplayStatus })
  displayStatus: DriverDocumentDisplayStatus;
  @ApiProperty({ type: 'string', nullable: true })
  documentNumber: string | null;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  issuedAt: Date | null;
  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  expiresAt: Date | null;
  /** Days until expiry. Negative = already expired. null = no expiry. */
  @ApiProperty({ type: 'integer', nullable: true })
  daysUntilExpiry: number | null;
  @ApiPropertyOptional({ type: 'string', format: 'date-time', nullable: true })
  reviewedAt: Date | null;
  @ApiPropertyOptional({ type: 'string', nullable: true })
  rejectionReason: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class DriverDocumentsSummaryDto {
  @ApiProperty({
    description:
      'How many documents are PENDING_REVIEW, REJECTED, EXPIRED, or EXPIRING_SOON. ' +
      'Drives the yellow banner at the top of the Documents screen.',
  })
  needsAttentionCount: number;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    nullable: true,
    description:
      'Timestamp of the most recent admin review (verify or reject) across ' +
      'the driver\'s documents. null if no document has ever been reviewed.',
  })
  lastReviewedAt: Date | null;

  @ApiProperty({
    description: 'Sum of expected types vs. uploaded types.',
    example: 4,
  })
  expectedTypeCount: number;

  @ApiProperty({ description: 'Number of distinct types the driver has uploaded.' })
  uploadedTypeCount: number;
}

export class ListDriverDocumentsResponseDto {
  @ApiProperty({ type: [DriverDocumentDto] })
  data: DriverDocumentDto[];

  @ApiProperty({ type: DriverDocumentsSummaryDto })
  summary: DriverDocumentsSummaryDto;
}
