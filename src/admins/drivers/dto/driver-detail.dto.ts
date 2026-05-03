import { ApiProperty } from '@nestjs/swagger';
import { DriverProfileResponseDto } from '../../../drivers/dto/driver-profile-response.dto';

export class DriverTripHistoryRowDto {
  @ApiProperty() id: number;
  @ApiProperty() route: string;
  @ApiProperty() type: string;
  @ApiProperty() status: string;
  @ApiProperty() departureTime: Date;
  @ApiProperty() completedAt: Date | null;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty() netEarnings: number | null;
}

export class DriverDeclineLogRowDto {
  @ApiProperty() id: number;
  @ApiProperty() reason: string;
  @ApiProperty() autoDeclined: boolean;
  @ApiProperty() declinedAt: Date;
}

/** S-04 admin counterpart — combines profile + history + decline log + simple stats. */
export class AdminDriverDetailDto extends DriverProfileResponseDto {
  @ApiProperty() completedTripCount: number;
  @ApiProperty() cancelledTripCount: number;
  @ApiProperty({ type: [DriverTripHistoryRowDto] })
  tripHistory: DriverTripHistoryRowDto[];
  @ApiProperty({ type: [DriverDeclineLogRowDto] })
  declineLog: DriverDeclineLogRowDto[];
}
