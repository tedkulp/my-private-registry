import { Test, TestingModule } from '@nestjs/testing';
import { LockfileService } from './lockfile.service';

describe('LockfileService', () => {
  let service: LockfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LockfileService],
    }).compile();

    service = module.get<LockfileService>(LockfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
