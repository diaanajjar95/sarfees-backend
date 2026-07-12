import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for `POST /admin/drivers/:id/suspend`. Reason is optional — when
 * provided it's stored on the driver row and surfaced back to the
 * suspended driver via `home-summary.suspensionInfo.reason`.
 */
export class SuspendDriverDto {
  @ApiPropertyOptional({
    example: 'Fraudulent activity report',
    description:
      'Optional reason string shown back to the driver on their home tab. ' +
      'Kept short — mobile UI truncates past ~140 chars.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
