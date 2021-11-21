import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { GarbageCollectionModule } from '../garbage-collection/garbage-collection.module';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [ScheduleModule.forRoot(), GarbageCollectionModule, RegistryModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
