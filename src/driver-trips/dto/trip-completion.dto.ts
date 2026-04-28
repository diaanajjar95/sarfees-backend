import { ApiProperty } from '@nestjs/swagger';

export class TripCompletionResponseDto {
  @ApiProperty() tripId: number;
  @ApiProperty() route: string;
  @ApiProperty() durationMinutes: number;
  @ApiProperty() passengersServed: number;
  @ApiProperty() packagesDelivered: number;

  @ApiProperty() totalCashCollected: number;
  @ApiProperty() commissionRate: number;
  @ApiProperty() commissionAmount: number;
  @ApiProperty() netEarnings: number;

  @ApiProperty() outstandingBalance: number;
}
