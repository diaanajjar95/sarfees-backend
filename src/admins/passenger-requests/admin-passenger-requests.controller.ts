import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { AdminPassengerRequestsService } from './admin-passenger-requests.service';
import {
  ListPassengerRequestsQueryDto,
  ListPassengerRequestsResponseDto,
  PassengerRequestRowDto,
} from './dto/list-passenger-requests.dto';
import { RolesGuard } from '../../shared/guards/roles.guard';

@ApiTags('Admin — Passenger Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/passenger-requests')
export class AdminPassengerRequestsController {
  constructor(private readonly service: AdminPassengerRequestsService) {}

  @ApiOperation({
    summary: 'List passenger trip requests (paginated, filterable by status / date)',
  })
  @ApiResponse({ status: 200, type: ListPassengerRequestsResponseDto })
  @Get()
  list(
    @Query() query: ListPassengerRequestsQueryDto,
  ): Promise<ListPassengerRequestsResponseDto> {
    return this.service.list(query);
  }

  @ApiOperation({ summary: 'Get a passenger trip request detail' })
  @ApiResponse({ status: 200, type: PassengerRequestRowDto })
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<PassengerRequestRowDto> {
    return this.service.detail(id);
  }
}
