import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TripGroupStatus } from '../../../shared/enums/trip-group-status.enum';

export class ListTripGroupsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /**
   * 'unassigned' (default) = groups still waiting for a driver
   * (open / frozen / offering / broadcasting / unserved_escalation).
   * 'all' = every group, newest first. Or a single exact status.
   */
  @ApiPropertyOptional({
    enum: ['unassigned', 'all', ...Object.values(TripGroupStatus)],
    default: 'unassigned',
  })
  @IsOptional()
  @IsIn(['unassigned', 'all', ...Object.values(TripGroupStatus)])
  status?: string;
}

export class TripGroupMemberDto {
  @ApiProperty() requestId: number;
  @ApiProperty({ example: 'Zaid Mansour' }) passengerName: string;
  @ApiProperty({ example: '+962 790000001' }) passengerPhone: string;
  @ApiProperty() seatsCount: number;
  @ApiProperty({ example: 'PENDING' }) requestStatus: string;
}

export class TripGroupRowDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: TripGroupStatus }) status: TripGroupStatus;
  @ApiProperty({ example: 'Amman' }) originCity: string;
  @ApiProperty({ example: 'Irbid' }) destCity: string;
  @ApiProperty() departureTime: Date;
  /** departureTime - 30 min: when the freeze + driver search fires. */
  @ApiProperty() driverSearchAt: Date;
  @ApiProperty({ nullable: true }) frozenAt: Date | null;
  @ApiProperty() womenOnly: boolean;
  @ApiProperty() fullCar: boolean;
  @ApiProperty() urgent: boolean;
  @ApiProperty() totalSeats: number;
  @ApiProperty() memberCount: number;
  @ApiProperty({ type: [TripGroupMemberDto] })
  members: TripGroupMemberDto[];
  @ApiProperty() createdAt: Date;
}

export class ListTripGroupsResponseDto {
  @ApiProperty({ type: [TripGroupRowDto] })
  data: TripGroupRowDto[];

  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;

  /** Count of groups currently waiting for a driver, regardless of filter. */
  @ApiProperty() unassignedCount: number;
}
