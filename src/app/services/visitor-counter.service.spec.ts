import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  BASELINE_VISITOR_COUNT,
  VISITOR_COUNTING_WINDOW_MS,
  VISITOR_SESSION_STORAGE_KEY,
  VisitorCounterService
} from './visitor-counter.service';

describe('VisitorCounterService', () => {
  let service: VisitorCounterService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        VisitorCounterService,
        { provide: Database, useValue: null }
      ]
    });
    service = TestBed.inject(VisitorCounterService);
  });

  it('records a unique visit on the first visit', async () => {
    const recorded = await service.recordUniqueVisit();
    expect(recorded).toBe(true);

    const stored = localStorage.getItem(VISITOR_SESSION_STORAGE_KEY);
    expect(stored).toBeTruthy();
    const session = JSON.parse(stored!);
    expect(session.id).toBeTypeOf('string');
    expect(session.lastRecordedAt).toBeTypeOf('number');
  });

  it('does NOT count a repeated visit within the 24-hour counting window', async () => {
    // First visit: should count
    const firstVisit = await service.recordUniqueVisit();
    expect(firstVisit).toBe(true);

    // Repeated visit immediately after (e.g. page refresh): should NOT count
    const secondVisit = await service.recordUniqueVisit();
    expect(secondVisit).toBe(false);
  });

  it('counts a visit again once the 24-hour window has expired', async () => {
    const expiredTimestamp = Date.now() - (VISITOR_COUNTING_WINDOW_MS + 5000);
    localStorage.setItem(
      VISITOR_SESSION_STORAGE_KEY,
      JSON.stringify({ id: 'vis_test_123', lastRecordedAt: expiredTimestamp })
    );

    const recorded = await service.recordUniqueVisit();
    expect(recorded).toBe(true);
  });

  it('does not display fabricated counts on unauthenticated visitor sessions', async () => {
    // Verified initial baseline
    expect(service.visitorCount()).toBe(BASELINE_VISITOR_COUNT);

    // Visit recorded in local session, but does NOT fabricate a fake counter increment
    await service.recordUniqueVisit();
    expect(service.visitorCount()).toBe(BASELINE_VISITOR_COUNT);
  });
});
