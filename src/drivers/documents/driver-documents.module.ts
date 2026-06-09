import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { DriverDocument } from './driver-document.entity';
import { DriverDocumentsService } from './driver-documents.service';
import { DriverDocumentsController } from './driver-documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DriverDocument]), PassportModule],
  controllers: [DriverDocumentsController],
  providers: [DriverDocumentsService],
  exports: [DriverDocumentsService],
})
export class DriverDocumentsModule {}
