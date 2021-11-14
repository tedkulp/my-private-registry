import { Module } from '@nestjs/common';

import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';

@Module({
  controllers: [RegistryController],
  providers: [RegistryService],
})
export class RegistryModule {}
