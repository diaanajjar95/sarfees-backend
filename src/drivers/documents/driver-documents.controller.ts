import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';
import { DriverDocumentsService } from './driver-documents.service';
import { UploadDriverDocumentDto } from './dto/upload-driver-document.dto';
import {
  DriverDocumentDto,
  ListDriverDocumentsResponseDto,
} from './dto/driver-document-response.dto';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('Driver Documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt-driver'))
@Controller('drivers/me/documents')
export class DriverDocumentsController {
  constructor(private readonly service: DriverDocumentsService) {}

  @ApiOperation({
    summary: 'Upload (or replace) a compliance document for the driver',
    description:
      'Multipart upload. The body is `multipart/form-data` with the file under ' +
      'the `file` field. Accepts JPG / PNG / WebP / HEIC / PDF up to 10 MB. ' +
      'If the driver already has a document of this `type`, the previous ' +
      'row + file are deleted — the table holds one document per ' +
      '(driver, type) at a time. Fresh uploads land as `pending_review`.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'type'],
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: [
            'driving_license',
            'vehicle_registration',
            'insurance_certificate',
            'national_id',
          ],
        },
        documentNumber: { type: 'string', example: '9123454821' },
        issuedAt: { type: 'string', format: 'date', example: '2022-03-15' },
        expiresAt: { type: 'string', format: 'date', example: '2027-03-15' },
      },
    },
  })
  @ApiResponse({ status: 201, type: DriverDocumentDto })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/driver-documents',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_FILE_BYTES },
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, HEIC, PDF.`,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDriverDocumentDto,
  ): Promise<DriverDocumentDto> {
    return this.service.upload(this.driverId(req), file, dto);
  }

  @ApiOperation({
    summary: "List the driver's compliance documents",
    description:
      'Returns the four document slots populated for this driver, plus a ' +
      'summary block the UI uses for the "N documents need attention" ' +
      'banner. `displayStatus` is pre-computed from `status` + `expiresAt` ' +
      'so the client renders the badge directly.',
  })
  @ApiResponse({ status: 200, type: ListDriverDocumentsResponseDto })
  @Get()
  list(@Req() req: Request): Promise<ListDriverDocumentsResponseDto> {
    return this.service.list(this.driverId(req));
  }

  @ApiOperation({ summary: 'Get one document by id' })
  @ApiResponse({ status: 200, type: DriverDocumentDto })
  @Get(':id')
  getOne(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverDocumentDto> {
    return this.service.getOne(this.driverId(req), id);
  }

  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @HttpCode(HttpStatus.OK)
  @Delete(':id')
  remove(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number }> {
    return this.service.remove(this.driverId(req), id);
  }

  private driverId(req: Request): number {
    return (req.user as { driverId: number }).driverId;
  }
}
