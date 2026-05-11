import {
  Body,
  Controller,
  Delete,
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FaqService } from './faq.service';
import {
  AdminFaqItemDto,
  CreateFaqItemDto,
  UpdateFaqItemDto,
} from './dto/admin-faq.dto';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { AdminRole } from '../shared/enums/admin-role.enum';

@ApiTags('Admin — FAQ')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-admin'), RolesGuard)
@Controller('admin/faq')
export class AdminFaqController {
  constructor(private readonly faqService: FaqService) {}

  @ApiOperation({ summary: 'List all FAQ entries (active + inactive)' })
  @ApiResponse({ status: 200, type: [AdminFaqItemDto] })
  @Get()
  list(): Promise<AdminFaqItemDto[]> {
    return this.faqService.listAdmin();
  }

  @ApiOperation({ summary: 'Get a single FAQ entry by id (full bilingual)' })
  @ApiResponse({ status: 200, type: AdminFaqItemDto })
  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminFaqItemDto> {
    return this.faqService.findById(id);
  }

  @ApiOperation({ summary: 'Create a new FAQ entry' })
  @ApiResponse({ status: 201, type: AdminFaqItemDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Post()
  create(@Body() dto: CreateFaqItemDto): Promise<AdminFaqItemDto> {
    return this.faqService.create(dto);
  }

  @ApiOperation({ summary: 'Update an FAQ entry (partial)' })
  @ApiResponse({ status: 200, type: AdminFaqItemDto })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFaqItemDto,
  ): Promise<AdminFaqItemDto> {
    return this.faqService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete an FAQ entry' })
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPS_MANAGER)
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.faqService.remove(id);
  }
}
