import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';
import { MobileApp } from './mobile-app-config.entity';
import { MobileAppConfigService } from './mobile-app-config.service';

const SEMVER = /^\d+\.\d+\.\d+$/;

class UpdateAppConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ description: 'Shown in the app while under maintenance.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  maintenanceMessageEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  maintenanceMessageAr?: string;

  @ApiPropertyOptional({ example: '1.2.0', description: 'Clients below this are FORCED to update.' })
  @IsOptional()
  @Matches(SEMVER)
  androidMinVersion?: string;

  @ApiPropertyOptional({ example: '1.4.1', description: 'Clients below this see an OPTIONAL update nudge.' })
  @IsOptional()
  @Matches(SEMVER)
  androidLatestVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  androidStoreUrl?: string;

  @ApiPropertyOptional({ example: '1.2.0' })
  @IsOptional()
  @Matches(SEMVER)
  iosMinVersion?: string;

  @ApiPropertyOptional({ example: '1.4.1' })
  @IsOptional()
  @Matches(SEMVER)
  iosLatestVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  iosStoreUrl?: string;
}

@ApiTags('Admin — App configs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/app-config')
export class AdminAppConfigController {
  constructor(private readonly service: MobileAppConfigService) {}

  @ApiOperation({ summary: 'Both app configs (passenger + driver)' })
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.OPS_MANAGER,
    AdminRole.SUPPORT,
    AdminRole.FINANCE,
  )
  @Get()
  getAll() {
    return this.service.getAll();
  }

  @ApiOperation({
    summary: 'Update one app (maintenance / versions / store URLs)',
    description:
      'Per-app control: put the passenger OR driver app under maintenance, ' +
      'raise minVersion to force-update old clients, raise latestVersion ' +
      'for an optional nudge. Apps pick changes up on next init/foreground.',
  })
  @Roles(AdminRole.SUPER_ADMIN)
  @Patch(':app')
  update(
    @Param('app', new ParseEnumPipe(MobileApp)) app: MobileApp,
    @Body() dto: UpdateAppConfigDto,
  ) {
    return this.service.update(app, dto);
  }
}
