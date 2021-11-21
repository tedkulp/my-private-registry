import { Test, TestingModule } from '@nestjs/testing';

import { GarbageCollectionService } from './garbage-collection.service';

describe('GarbageCollectionService', () => {
  let service: GarbageCollectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GarbageCollectionService],
    }).compile();

    service = module.get<GarbageCollectionService>(GarbageCollectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
