import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { FaqItem } from './faq-item.entity';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { AdminFaqController } from './admin-faq.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FaqItem]), PassportModule],
  controllers: [FaqController, AdminFaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
