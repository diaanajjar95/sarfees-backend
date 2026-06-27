import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for `PUT /drivers/me/fcm-token`. Sent by the driver app on:
 *   - login (right after verify-otp succeeds)
 *   - whenever FirebaseMessaging fires a token-refresh callback
 */
export class UpdateFcmTokenDto {
  @ApiProperty({
    description:
      'Firebase Cloud Messaging registration token for the device. ' +
      'Used by the backend to address push notifications to this driver.',
    example: 'fGz3iY...:APA91b...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fcmToken: string;
}

export class UpdateFcmTokenResponseDto {
  @ApiProperty({ example: true })
  updated: boolean;
}
