import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';
import { PlatformCurrency } from './platform-config.entity';
import { CURRENCIES, PlatformConfigService } from './platform-config.service';

class UpdatePlatformConfigDto {
  @ApiProperty({ enum: PlatformCurrency })
  @IsEnum(PlatformCurrency)
  currencyCode: PlatformCurrency;
}

@ApiTags('Admin — Platform')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/platform-config')
export class AdminPlatformController {
  constructor(private readonly config: PlatformConfigService) {}

  @ApiOperation({ summary: 'Platform config + available currencies' })
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.FINANCE,
    AdminRole.OPS_MANAGER,
    AdminRole.SUPPORT,
  )
  @Get()
  async get() {
    const row = await this.config.getConfig();
    return {
      currencyCode: row.currencyCode,
      currency: CURRENCIES[row.currencyCode],
      availableCurrencies: Object.values(CURRENCIES),
      updatedAt: row.updatedAt,
    };
  }

  @ApiOperation({
    summary: 'Switch the platform currency (JOD ⇄ SYP)',
    description:
      'Display-level switch: amounts are stored as plain numbers and ' +
      'are NOT converted — every price, fare, fee, and wallet balance ' +
      'is re-read in the new currency.',
  })
  @Roles(AdminRole.SUPER_ADMIN)
  @Patch()
  async update(@Body() dto: UpdatePlatformConfigDto) {
    await this.config.setCurrency(dto.currencyCode);
    return this.get();
  }
}
