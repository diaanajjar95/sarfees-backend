import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Shared body for the two ops-cancel endpoints
 * (POST /admin/trips/:id/cancel, POST /admin/passenger-requests/:id/cancel).
 * The reason is mandatory — every ops cancellation must be explainable
 * to the affected passenger and auditable later.
 */
export class AdminCancelDto {
  @ApiProperty({
    example: 'Driver reported a breakdown; no replacement available.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
