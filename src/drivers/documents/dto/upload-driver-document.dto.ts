import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DriverDocumentType } from '../../../shared/enums/driver-document-type.enum';

/**
 * Multipart form-data body for `POST /drivers/me/documents`.
 * The file itself is read from the `file` form field via the
 * `FileInterceptor` on the controller — it's not declared here.
 */
export class UploadDriverDocumentDto {
  @ApiProperty({
    enum: DriverDocumentType,
    description: 'Which document slot this file goes into.',
  })
  @IsEnum(DriverDocumentType)
  type: DriverDocumentType;

  @ApiPropertyOptional({
    description: 'The document number (license number, plate, etc.).',
    example: '9123454821',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  documentNumber?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 issue date.',
    example: '2022-03-15',
  })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601 expiry date. Omit for documents that never expire (e.g. National ID).',
    example: '2027-03-15',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
