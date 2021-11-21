import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LockfileService {
  private locks: string[] = [];
  private readonly logger = new Logger(LockfileService.name);

  hasLocks() {
    return this.locks.length > 0;
  }

  addLock(lockId: string) {
    this.locks.push(lockId);
    this.logger.debug(
      `Adding lock: ${lockId}. Current Count: ${this.locks.length}`,
    );
  }

  removeLock(lockId: string) {
    this.locks = this.locks.filter((l) => l !== lockId);
    this.logger.debug(
      `Removing lock: ${lockId}. Current Count: ${this.locks.length}`,
    );
  }
}
