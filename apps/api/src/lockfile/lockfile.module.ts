import { Module } from '@nestjs/common';

import { LockfileInterceptor } from './lockfile.interceptor';
import { LockfileService } from './lockfile.service';

@Module({
  providers: [LockfileInterceptor, LockfileService],
  exports: [LockfileInterceptor, LockfileService],
})
export class LockfileModule {}
