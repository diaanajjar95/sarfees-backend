import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user',
    type: UserResponseDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(@Req() req: any): Promise<UserResponseDto> {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      // should not happen because the guard already validated the JWT,
      // but keeps types honest
      throw new Error('User not found');
    }
    const tripCount = await this.usersService.getTripCount(user.id);
    return UserResponseDto.from(user, tripCount);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete / update user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserResponseDto,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'User profile details including optional profile photo',
    type: CompleteProfileDto,
  })
  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: './uploads/profiles',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async completeProfile(
    @Req() req: any,
    @Body() completeProfileDto: CompleteProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const userId = req.user.userId;
    const photoPath = file ? `/uploads/profiles/${file.filename}` : undefined;
    const user = await this.usersService.completeProfile(
      userId,
      completeProfileDto,
      photoPath,
    );
    const tripCount = await this.usersService.getTripCount(user.id);
    return UserResponseDto.from(user, tripCount);
  }
}
