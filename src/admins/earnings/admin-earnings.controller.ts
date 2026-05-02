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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminEarningsService } from './admin-earnings.service';
import {
  AdminBalanceQueryDto,
  AdminEarningsDashboardDto,
  AdminEarningsQueryDto,
  DriverBalancesResponseDto,
  SettleBalanceDto,
  SettleBalanceResponseDto,
} from './dto/admin-earnings.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminRole } from '../../shared/enums/admin-role.enum';

@ApiTags('Admin — Earnings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/earnings')
export class AdminEarningsController {
  constructor(private readonly service: AdminEarningsService) {}

  @ApiOperation({ summary: 'Earnings dashboard (KPIs + city rollup)' })
  @ApiResponse({ status: 200, type: AdminEarningsDashboardDto })
  @Get('dashboard')
  dashboard(
    @Query() query: AdminEarningsQueryDto,
  ): Promise<AdminEarningsDashboardDto> {
    return this.service.dashboard(query);
  }

  @ApiOperation({ summary: 'Per-driver outstanding balances (paginated)' })
  @ApiResponse({ status: 200, type: DriverBalancesResponseDto })
  @Get('balances')
  balances(
    @Query() query: AdminBalanceQueryDto,
  ): Promise<DriverBalancesResponseDto> {
    return this.service.balances(query);
  }

  @ApiOperation({
    summary: 'Settle (reduce) a driver outstanding balance',
    description:
      'Records that the driver paid the platform `amount` JD against their commission debt. amount must be > 0 and <= current balance.',
  })
  @ApiResponse({ status: 200, type: SettleBalanceResponseDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Post('balances/:driverId/settle')
  settle(
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: SettleBalanceDto,
  ): Promise<SettleBalanceResponseDto> {
    return this.service.settle(driverId, dto);
  }
}
