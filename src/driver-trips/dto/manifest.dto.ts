import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverTripStatus } from '../../shared/enums/driver-trip-status.enum';
import { DriverTripType } from '../../shared/enums/driver-trip-type.enum';
import { DriverTripStopStatus } from '../../shared/enums/driver-trip-stop-status.enum';
import { DriverTripStopType } from '../../shared/enums/driver-trip-stop-type.enum';
import {
  StopPassengerRole,
  StopPassengerStatus,
} from '../../shared/enums/stop-passenger-status.enum';
import {
  StopPackageRole,
  StopPackageStatus,
} from '../../shared/enums/stop-package-status.enum';
import { PackageSize } from '../../shared/enums/package-size.enum';

export class ManifestPassengerDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'Ahmad K.' }) name: string;
  @ApiPropertyOptional({ enum: ['Male', 'Female'] }) gender: string | null;
  @ApiProperty({ example: '+962 7X XXX XX78', description: 'Masked phone' })
  phoneMasked: string;
  @ApiProperty({ enum: StopPassengerRole }) role: StopPassengerRole;
  @ApiProperty() fare: number;
  @ApiProperty({ enum: StopPassengerStatus }) status: StopPassengerStatus;
  @ApiPropertyOptional() cashCollected: boolean | null;
}

export class ManifestPackageDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'PKG-201' }) reference: string;
  @ApiProperty({ example: 'Hala A.' }) senderName: string;
  @ApiProperty({ example: '+962 7X XXX XX22' }) senderPhoneMasked: string;
  @ApiProperty({ example: 'Yousef R.' }) receiverName: string;
  @ApiProperty({ example: '+962 7X XXX XX44' }) receiverPhoneMasked: string;
  @ApiProperty({ enum: PackageSize }) size: PackageSize;
  @ApiPropertyOptional() description: string | null;
  @ApiProperty() fee: number;
  @ApiProperty({ enum: StopPackageRole }) role: StopPackageRole;
  @ApiProperty({ enum: StopPackageStatus }) status: StopPackageStatus;
}

export class ManifestStopDto {
  @ApiProperty() id: number;
  @ApiProperty() order: number;
  @ApiProperty({ enum: DriverTripStopType }) type: DriverTripStopType;
  @ApiProperty() city: string;
  @ApiPropertyOptional() address: string | null;
  @ApiProperty({ example: 31.9539 }) lat: number;
  @ApiProperty({ example: 35.9106 }) lng: number;
  @ApiProperty({ enum: DriverTripStopStatus }) status: DriverTripStopStatus;
  @ApiProperty() cashExpected: number;
  @ApiProperty({ type: [ManifestPassengerDto] })
  passengers: ManifestPassengerDto[];
  @ApiProperty({ type: [ManifestPackageDto] })
  packages: ManifestPackageDto[];
}

export class ManifestSummaryDto {
  @ApiProperty() stopCount: number;
  @ApiProperty() passengerCount: number;
  @ApiProperty() packageCount: number;
  @ApiProperty() estimatedDurationMinutes: number;
}

export class ManifestResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ enum: DriverTripType }) type: DriverTripType;
  @ApiProperty({ enum: DriverTripStatus }) status: DriverTripStatus;
  @ApiProperty() originCity: string;
  @ApiProperty() destinationCity: string;
  @ApiProperty() departureTime: Date;
  @ApiProperty() currentStopIndex: number;
  @ApiProperty() totalCashExpected: number;
  @ApiProperty() totalCashCollected: number;
  @ApiProperty() commissionRate: number;
  @ApiProperty({ type: ManifestSummaryDto }) summary: ManifestSummaryDto;
  @ApiProperty({ type: [ManifestStopDto] }) stops: ManifestStopDto[];
}
