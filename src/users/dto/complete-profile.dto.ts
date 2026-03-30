import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CompleteProfileDto {
  @ApiProperty({ description: 'The first name of the user', example: 'Ali' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'The last name of the user', example: 'Ahmad' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'The gender of the user', enum: ['Male', 'Female'] })
  @IsEnum(['Male', 'Female'])
  gender: string;

  @ApiProperty({ description: 'The email of the user', example: 'ali@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ 
    type: 'string', 
    format: 'binary', 
    required: false, 
    description: 'Profile photo to upload (Camera/Gallery)' 
  })
  @IsOptional()
  profilePhoto?: any;
}
