import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CitiesService } from './cities.service';

@ApiTags('Cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @ApiOperation({ summary: 'Get all available cities dynamically translated.' })
  @ApiResponse({ status: 200, description: 'Cities retrieved successfully' })
  @Get()
  findAll() {
    return this.citiesService.findAll();
  }
}
