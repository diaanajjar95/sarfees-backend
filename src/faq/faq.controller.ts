import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FaqService } from './faq.service';
import { FaqItemDto } from './dto/faq-item.dto';

@ApiTags('FAQ')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @ApiOperation({
    summary: 'Get the FAQ list localized by Accept-Language',
    description:
      'Returns active FAQ entries sorted by display order. Each entry is single-language — `question`, `answer`, and `category` are resolved server-side from the request `Accept-Language` header (`en` or `ar`; defaults to `en`). Inactive entries are hidden.',
  })
  @ApiResponse({ status: 200, type: [FaqItemDto] })
  @Get()
  list(): Promise<FaqItemDto[]> {
    return this.faqService.listPublic();
  }
}
