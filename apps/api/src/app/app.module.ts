import { Module } from '@nestjs/common';

import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [RegistryModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
