import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@sarfees.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ChangeMe!2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
