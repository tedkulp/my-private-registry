import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { v4 } from 'uuid';

import { LockfileService } from './lockfile.service';

@Injectable()
export class LockfileInterceptor implements NestInterceptor {
  constructor(private lockfileService: LockfileService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    const lockId = v4();
    this.lockfileService.addLock(lockId);

    return next.handle().pipe(
      finalize(() => {
        // Wait 30 seconds and then clear the lock
        const handle = setTimeout(() => {
          this.lockfileService.removeLock(lockId);
          clearTimeout(handle);
        }, 30000);
      }),
    );
  }
}
