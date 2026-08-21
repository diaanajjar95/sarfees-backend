import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdminCustomersService } from './admin-customers.service';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AdminRole } from '../../shared/enums/admin-role.enum';

class ListCustomersQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Matches name or phone number.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}

@ApiTags('Admin — Customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER, AdminRole.SUPPORT, AdminRole.FINANCE)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly service: AdminCustomersService) {}

  @ApiOperation({ summary: 'List/search customers (passengers)' })
  @Get()
  list(@Query() q: ListCustomersQueryDto) {
    return this.service.list(q.page ?? 1, q.limit ?? 20, q.search);
  }

  @ApiOperation({
    summary: 'Customer detail: profile, trip history, ratings both ways',
  })
  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }
}
