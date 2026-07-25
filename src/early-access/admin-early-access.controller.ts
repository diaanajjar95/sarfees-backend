import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EarlyAccessService } from './early-access.service';
import {
  ListEarlyAccessQueryDto,
  ListEarlyAccessResponseDto,
} from './dto/list-early-access.dto';
import { RolesGuard } from '../shared/guards/roles.guard';

@ApiTags('Admin — Early Access')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/early-access')
export class AdminEarlyAccessController {
  constructor(private readonly service: EarlyAccessService) {}

  @ApiOperation({
    summary: 'List pre-launch signups (paginated, filterable by role)',
  })
  @ApiResponse({ status: 200, type: ListEarlyAccessResponseDto })
  @Get()
  list(
    @Query() query: ListEarlyAccessQueryDto,
  ): Promise<ListEarlyAccessResponseDto> {
    return this.service.list(query);
  }
}
