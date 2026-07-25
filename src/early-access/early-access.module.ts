import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { EarlyAccessSignup } from './entities/early-access-signup.entity';
import { EarlyAccessService } from './early-access.service';
import { EarlyAccessController } from './early-access.controller';
import { AdminEarlyAccessController } from './admin-early-access.controller';

@Module({
  imports: [PassportModule, TypeOrmModule.forFeature([EarlyAccessSignup])],
  controllers: [EarlyAccessController, AdminEarlyAccessController],
  providers: [EarlyAccessService],
})
export class EarlyAccessModule {}
