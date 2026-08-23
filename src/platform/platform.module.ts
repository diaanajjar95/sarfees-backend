import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { PlatformConfig } from './platform-config.entity';
import { PlatformConfigService } from './platform-config.service';
import { PlatformController } from './platform.controller';
import { AdminPlatformController } from './admin-platform.controller';

@Module({
  imports: [PassportModule, TypeOrmModule.forFeature([PlatformConfig])],
  controllers: [PlatformController, AdminPlatformController],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformModule {}
