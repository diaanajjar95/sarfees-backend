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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { WalletConfigService } from './wallet-config.service';
import {
  CreditWalletDto,
  PageQueryDto,
  UpdateWalletConfigDto,
} from './dto/wallet.dto';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';

@ApiTags('Admin — Wallets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin')
export class AdminWalletsController {
  constructor(
    private readonly wallets: WalletsService,
    private readonly config: WalletConfigService,
  ) {}

  @ApiOperation({ summary: 'Wallet config (commission %, low-balance threshold)' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.FINANCE)
  @Get('wallet-config')
  async getConfig() {
    const c = await this.config.getConfig();
    return {
      commissionPercent: Number(c.commissionPercent),
      lowBalanceThresholdJod: Number(c.lowBalanceThresholdJod),
      lowBalanceNotifyCooldownHours: c.lowBalanceNotifyCooldownHours,
      updatedAt: c.updatedAt,
    };
  }

  @ApiOperation({
    summary: 'Update wallet config',
    description:
      'Commission % applies to trips created AFTER the change — every ' +
      'trip snapshots its rate at creation.',
  })
  @Roles(AdminRole.SUPER_ADMIN)
  @Patch('wallet-config')
  async updateConfig(@Body() dto: UpdateWalletConfigDto) {
    await this.config.update(dto);
    return this.getConfig();
  }

  @ApiOperation({ summary: 'Driver wallet summary' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.FINANCE, AdminRole.OPS_MANAGER)
  @Get('wallets/:driverId')
  walletSummary(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.wallets.getWalletSummary(driverId);
  }

  @ApiOperation({ summary: 'Driver wallet transaction history' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.FINANCE, AdminRole.OPS_MANAGER)
  @Get('wallets/:driverId/transactions')
  walletTransactions(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Query() q: PageQueryDto,
  ) {
    return this.wallets.listTransactions(driverId, q.page ?? 1, q.limit ?? 20);
  }

  @ApiOperation({
    summary: 'Credit a driver wallet (manual credit or refund)',
  })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Post('wallets/:driverId/credit')
  credit(
    @Req() req: Request,
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: CreditWalletDto,
  ) {
    const adminId = (req.user as { adminId: number }).adminId;
    return this.wallets.creditDriver(
      adminId,
      driverId,
      dto.amount,
      dto.kind,
      dto.note,
    );
  }
}
