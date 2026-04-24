import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Phone number (digits only, no country code)',
    example: '7712345678',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{6,15}$/, {
    message: 'phoneNumber must contain 6-15 digits only (no spaces or symbols)',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Country calling code in E.164 format (e.g. +962, +1)',
    example: '+962',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9][0-9]{0,3}$/, {
    message: 'countryCode must be in the format +<digits> (e.g. +962)',
  })
  countryCode: string;
}
