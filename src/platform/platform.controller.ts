import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformConfigService } from './platform-config.service';

@ApiTags('Platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly config: PlatformConfigService) {}

  @ApiOperation({
    summary: 'Active platform currency (public)',
    description:
      'The currency every amount on the platform is denominated in. ' +
      'Apps fetch this at startup and render all money with the ' +
      'returned symbol and decimals. Switchable from the admin portal ' +
      '(JOD ⇄ SYP).',
  })
  @Get('currency')
  currency() {
    return this.config.currency();
  }
}
