import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { PageQueryDto } from './dto/wallet.dto';

@ApiTags('Driver — Wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-driver'))
@Controller('drivers/wallet')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  private driverId(req: Request): number {
    return (req.user as { driverId: number }).driverId;
  }

  @ApiOperation({
    summary: 'Wallet balance + low-balance state',
    description:
      'Prepaid balance the platform commission is deducted from. When ' +
      'the balance cannot cover a trip’s commission ' +
      '(commissionPercent × trip total price) the driver receives no ' +
      'offers until they top up at a card seller.',
  })
  @Get()
  summary(@Req() req: Request) {
    return this.wallets.getWalletSummary(this.driverId(req));
  }

  @ApiOperation({
    summary: 'Wallet transaction history (newest first)',
    description:
      'Signed amounts: top-ups/credits/refunds positive, trip commission ' +
      'negative. balanceAfter is the running balance.',
  })
  @Get('transactions')
  transactions(@Req() req: Request, @Query() q: PageQueryDto) {
    return this.wallets.listTransactions(
      this.driverId(req),
      q.page ?? 1,
      q.limit ?? 20,
    );
  }
}
