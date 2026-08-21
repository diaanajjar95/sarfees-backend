import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { RatingLevel } from '../../shared/enums/rating.enum';

export class SubmitRatingDto {
  @ApiProperty({
    enum: RatingLevel,
    example: 'excellent',
    description:
      'excellent(5) | very_good(4) | good(3) | not_bad(2) | bad(1). ' +
      'A `bad` rating REQUIRES a message.',
  })
  @IsIn(Object.values(RatingLevel))
  level: RatingLevel;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Optional feedback — required when level is `bad`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RatePassengerDto extends SubmitRatingDto {
  @ApiProperty({ example: 8, description: 'Passenger user id from /ratables' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  passengerId: number;
}

export class RatePackageSenderDto extends SubmitRatingDto {
  @ApiProperty({
    example: 14,
    description: 'packageDeliveryId from /ratables (kind: "sender")',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packageDeliveryId: number;
}
