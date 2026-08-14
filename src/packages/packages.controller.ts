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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PackagesService } from './packages.service';
import { EstimatePackageDto, CreatePackageDeliveryDto } from './dto/create-package-delivery.dto';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto';

@ApiTags('Packages')
@Controller('packages')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @ApiOperation({
    summary: 'Prohibited items list (§6.4) — show next to the legal attestation',
  })
  @ApiResponse({ status: 200, description: 'Bilingual prohibited items list' })
  @Get('prohibited-items')
  prohibitedItems() {
    return this.packagesService.prohibitedItems();
  }

  @ApiOperation({ summary: 'Estimate delivery fee based on package size and route' })
  @ApiResponse({ status: 200, description: 'Delivery fee estimated' })
  @Post('estimate')
  estimateFee(@Body() estimateDto: EstimatePackageDto) {
    return this.packagesService.estimateFee(estimateDto);
  }

  @ApiOperation({ summary: 'Submit a new package delivery request' })
  @ApiResponse({ status: 201, description: 'Package delivery request created' })
  @Post('request')
  @UseInterceptors(
    FileInterceptor('packagePhoto', {
      storage: diskStorage({
        destination: './uploads/packages',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async createDelivery(
    @Req() req: any,
    @Body() createDto: CreatePackageDeliveryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    const photoPath = file ? `/uploads/packages/${file.filename}` : undefined;
    return this.packagesService.createDelivery(userId, createDto, photoPath);
  }

  @ApiOperation({ summary: 'Get all package delivery requests for the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of package deliveries' })
  @Get('my-packages')
  getUserPackages(@Req() req: any, @Query() query: PaginationQueryDto) {
    return this.packagesService.getUserPackages(req.user.userId, query);
  }

  @ApiOperation({
    summary: "Get the sender's currently active package",
    description:
      'Returns the most recent package delivery in PENDING / MATCHED / PICKED_UP / IN_TRANSIT. 404 when none exists. Mirrors GET /trips/active.',
  })
  @ApiResponse({ status: 200, description: 'Active package delivery' })
  @ApiResponse({ status: 404, description: 'No active package' })
  @Get('active')
  getActivePackage(@Req() req: any) {
    return this.packagesService.getActivePackage(req.user.userId);
  }

  @ApiOperation({
    summary: 'Cancel a delivery (sender, §6.7)',
    description:
      'Free before a driver is assigned; a cancellation fee applies after assignment (flag in the response). Blocked once the parcel is with the driver — the ops return flow takes over.',
  })
  @ApiResponse({ status: 200, description: 'Delivery cancelled' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancelDelivery(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.packagesService.cancelDelivery(req.user.userId, id);
  }

  @ApiOperation({ summary: 'Get a specific package delivery by ID' })
  @ApiResponse({ status: 200, description: 'Package delivery details' })
  @Get(':id')
  getPackageById(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.packagesService.getPackageById(id, req.user.userId);
  }
}
