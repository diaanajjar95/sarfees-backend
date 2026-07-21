import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListEscalationsQueryDto {
  @ApiPropertyOptional({
    description: "'open' (default) shows unresolved; 'resolved' shows resolved; 'all' returns both",
    enum: ['open', 'resolved', 'all'],
  })
  @IsOptional()
  @IsString()
  filter?: 'open' | 'resolved' | 'all';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class EscalationItemDto {
  @ApiProperty() id: number;
  @ApiProperty() tripGroupId: number;
  @ApiProperty() originCity: string;
  @ApiProperty() destinationCity: string;
  @ApiProperty() departureTime: string;
  @ApiProperty() passengerCount: number;
  @ApiProperty() womenOnly: boolean;
  @ApiProperty() escalatedAt: string;
  @ApiProperty({ nullable: true }) resolvedAt: string | null;
  @ApiProperty({ nullable: true }) resolutionNotes: string | null;
}

export class ListEscalationsResponseDto {
  @ApiProperty({ type: [EscalationItemDto] }) data: EscalationItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
