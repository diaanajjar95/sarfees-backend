import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, ValidateIf } from 'class-validator';

export class MarkReadDto {
  @ApiPropertyOptional({
    type: [Number],
    description: 'Specific notification ids to mark read. Ignored if `all` is true.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  notificationIds?: number[];

  @ApiPropertyOptional({
    description: 'When true, mark every unread notification as read.',
  })
  @IsOptional()
  @IsBoolean()
  all?: boolean;

  // At least one of the two must be supplied — checked at the service layer
  // (class-validator alone can't express XOR cleanly).
  @ValidateIf((o: MarkReadDto) => o.all === undefined && !o.notificationIds)
  @IsOptional()
  _placeholder?: never;
}
