import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DriverSuspensionCategory } from '../../../shared/enums/driver-suspension-category.enum';

/**
 * Body for `POST /admin/drivers/:id/suspend`. Both fields are optional —
 * `category` picks which suspended-state card the mobile Home tab renders
 * (documents / rating / payment / violation); `reason` is a free-text
 * message shown back to the driver.
 */
export class SuspendDriverDto {
  @ApiPropertyOptional({
    enum: DriverSuspensionCategory,
    description:
      'Which suspended-state card variant the mobile Home tab should render. ' +
      "Omit for legacy 'generic suspension' behavior.",
  })
  @IsOptional()
  @IsEnum(DriverSuspensionCategory)
  category?: DriverSuspensionCategory;

  @ApiPropertyOptional({
    example: 'Vehicle registration expired',
    description:
      'Optional reason string shown back to the driver on their home tab. ' +
      'Kept short — mobile UI truncates past ~140 chars.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
