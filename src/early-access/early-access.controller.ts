import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EarlyAccessService } from './early-access.service';
import { CreateEarlyAccessSignupDto } from './dto/create-early-access-signup.dto';

@ApiTags('Early Access')
@Controller('early-access')
export class EarlyAccessController {
  constructor(private readonly service: EarlyAccessService) {}

  @ApiOperation({
    summary: 'Register pre-launch interest (public landing-page form)',
    description:
      'Unauthenticated. Stores a "Join Early" registration from the ' +
      'landing page — passenger or driver flavor, chip answers, and an ' +
      'optional phone when the visitor is open to pilot trips.',
  })
  @ApiResponse({ status: 201, description: 'Stored. Returns the new id.' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateEarlyAccessSignupDto): Promise<{ id: number }> {
    return this.service.create(dto);
  }
}
