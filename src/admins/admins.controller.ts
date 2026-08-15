import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminsService } from './admins.service';
import { AdminResponseDto } from './dto/admin-response.dto';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';

class CreateAdminDto {
  @ApiProperty({ example: 'seller1@sarfees.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Cards Shop — Downtown' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @ApiProperty({ enum: AdminRole })
  @IsIn(Object.values(AdminRole))
  role: AdminRole;

  @ApiProperty({ minLength: 8, description: 'Shown once; forced change on first login' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  tempPassword: string;
}

class UpdateAdminDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: AdminRole })
  @IsOptional()
  @IsIn(Object.values(AdminRole))
  role?: AdminRole;
}

/**
 * Admin account management — super admin only. Exists primarily so
 * seller accounts (prepaid-card distributors) can be created without
 * SQL. Note: role changes take effect on the target's next login —
 * the role is baked into the JWT.
 */
@ApiTags('Admin — Accounts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
@Controller('admin/admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @ApiOperation({ summary: 'List all admin accounts' })
  @Get()
  async list(): Promise<AdminResponseDto[]> {
    const rows = await this.admins.list();
    return rows.map((a) => AdminResponseDto.from(a));
  }

  @ApiOperation({
    summary: 'Create an admin account (incl. sellers)',
    description:
      'tempPassword is shown to the creator once; the new account must ' +
      'change it on first login.',
  })
  @Post()
  async create(@Body() dto: CreateAdminDto): Promise<AdminResponseDto> {
    const admin = await this.admins.create(dto);
    return AdminResponseDto.from(admin);
  }

  @ApiOperation({ summary: 'Activate/deactivate or change role' })
  @HttpCode(HttpStatus.OK)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminDto,
  ): Promise<AdminResponseDto> {
    const admin = await this.admins.update(id, dto);
    return AdminResponseDto.from(admin);
  }
}
