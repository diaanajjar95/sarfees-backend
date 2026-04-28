import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverTripStopStatus } from '../../shared/enums/driver-trip-stop-status.enum';
import { DriverTripStopType } from '../../shared/enums/driver-trip-stop-type.enum';

export class CurrentStopDto {
  @ApiProperty() id: number;
  @ApiProperty() order: number;
  @ApiProperty({ enum: DriverTripStopType }) type: DriverTripStopType;
  @ApiProperty() city: string;
  @ApiPropertyOptional() address: string | null;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ enum: DriverTripStopStatus }) status: DriverTripStopStatus;
  @ApiProperty() cashExpected: number;
  @ApiProperty() passengerCount: number;
  @ApiProperty() packageCount: number;
}

export class ActiveStateResponseDto {
  @ApiProperty() tripId: number;
  @ApiProperty({ enum: DriverTripStatus }) status: DriverTripStatus;
  @ApiProperty() currentStopIndex: number;
  @ApiProperty() totalStops: number;
  @ApiProperty() remainingStops: number;
  @ApiPropertyOptional({ type: CurrentStopDto })
  currentStop: CurrentStopDto | null;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty() totalCashExpected: number;
}
