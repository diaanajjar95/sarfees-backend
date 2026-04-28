import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverTripType } from '../../shared/enums/driver-trip-type.enum';

export class OfferStopPreviewDto {
  @ApiProperty() order: number;
  @ApiProperty() city: string;
  @ApiPropertyOptional() address: string | null;
  @ApiProperty({ example: 'pickup', description: 'pickup | dropoff | pickup_dropoff' })
  type: string;
}

export class OfferResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverTripType }) type: DriverTripType;
  @ApiProperty() originCity: string;
  @ApiProperty() destinationCity: string;
  @ApiProperty() departureTime: Date;
  @ApiProperty() passengerCount: number;
  @ApiProperty() packageCount: number;
  @ApiProperty() stopCount: number;
  @ApiProperty() estimatedDurationMinutes: number;
  @ApiProperty({
    description:
      'Estimated total cash to collect across the trip (passenger fares + package fees)',
  })
  estimatedCashToCollect: number;
  @ApiProperty() offeredAt: Date;
  @ApiProperty() offerExpiresAt: Date;
  @ApiProperty({ description: 'Seconds remaining before the offer auto-expires' })
  secondsRemaining: number;
  @ApiProperty({ type: [OfferStopPreviewDto] })
  stopPreview: OfferStopPreviewDto[];
}
