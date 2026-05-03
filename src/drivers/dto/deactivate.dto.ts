import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const DEACTIVATE_REASONS = ['manual', 'fatigue', 'other'] as const;
export type DeactivateReason = (typeof DEACTIVATE_REASONS)[number];

export class DeactivateDto {
  @ApiPropertyOptional({
    example: 'manual',
    enum: DEACTIVATE_REASONS,
  })
  @IsOptional()
  @IsString()
  @IsIn(DEACTIVATE_REASONS)
  reason?: DeactivateReason;
}
