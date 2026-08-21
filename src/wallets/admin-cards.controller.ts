import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import {
  CreateCardBatchDto,
  ListCardsQueryDto,
  LookupDriverDto,
  RedeemCardDto,
} from './dto/wallet.dto';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';

interface AdminReqUser {
  adminId: number;
  role: AdminRole;
}

@ApiTags('Admin — Top-up Cards')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/cards')
export class AdminCardsController {
  constructor(private readonly wallets: WalletsService) {}

  private me(req: Request): AdminReqUser {
    return req.user as AdminReqUser;
  }

  private sellerScope(req: Request): number | undefined {
    const u = this.me(req);
    return u.role === AdminRole.SELLER ? u.adminId : undefined;
  }

  @ApiOperation({
    summary: 'Generate a batch of prepaid top-up cards',
    description:
      'Returns the full card codes ONCE — they are masked everywhere ' +
      'afterwards. Sellers print/distribute them.',
  })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SELLER)
  @Post('batches')
  createBatch(@Req() req: Request, @Body() dto: CreateCardBatchDto) {
    return this.wallets.generateBatch(this.me(req).adminId, dto.amount, dto.count);
  }

  @ApiOperation({ summary: 'List card batches (sellers see their own)' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SELLER)
  @Get('batches')
  listBatches(@Req() req: Request) {
    return this.wallets.listBatches(this.sellerScope(req));
  }

  @ApiOperation({ summary: 'List cards (masked codes; sellers see their own)' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SELLER)
  @Get()
  listCards(@Req() req: Request, @Query() q: ListCardsQueryDto) {
    return this.wallets.listCards({
      adminId: this.sellerScope(req),
      batchId: q.batchId,
      status: q.status,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
  }

  @ApiOperation({
    summary: 'Confirm a driver by phone before redeeming',
    description: 'Returns only whether the number exists and the driver name.',
  })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SELLER)
  @HttpCode(HttpStatus.OK)
  @Post('lookup-driver')
  lookupDriver(@Body() dto: LookupDriverDto) {
    return this.wallets.lookupDriverByPhone(
      dto.driverPhone,
      dto.countryCode ?? '+962',
    );
  }

  @ApiOperation({
    summary: 'Redeem a card onto a driver wallet by mobile number',
    description:
      '409 if already redeemed, 400 if voided, 404 for unknown code or ' +
      'phone. Sellers can only redeem cards from their own batches.',
  })
  @ApiResponse({ status: 200, description: '{ driverName, amount }' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SELLER)
  @HttpCode(HttpStatus.OK)
  @Post('redeem')
  redeem(@Req() req: Request, @Body() dto: RedeemCardDto) {
    const u = this.me(req);
    return this.wallets.redeemCard(
      u.adminId,
      u.role === AdminRole.SELLER,
      dto.code,
      dto.driverPhone,
      dto.countryCode ?? '+962',
    );
  }

  @ApiOperation({ summary: 'Void an unredeemed card' })
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post(':id/void')
  async void(@Param('id', ParseIntPipe) id: number) {
    await this.wallets.voidCard(id);
    return { ok: true };
  }
}
