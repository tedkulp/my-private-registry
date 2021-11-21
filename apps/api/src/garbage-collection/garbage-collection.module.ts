import { Module } from '@nestjs/common';

import { LockfileModule } from '../lockfile/lockfile.module';
import { RegistryModule } from '../registry/registry.module';
import { GarbageCollectionService } from './garbage-collection.service';

@Module({
  imports: [LockfileModule, RegistryModule],
  providers: [GarbageCollectionService],
})
export class GarbageCollectionModule {}
