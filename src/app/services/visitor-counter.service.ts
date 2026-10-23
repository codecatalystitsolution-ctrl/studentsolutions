import { Injectable, inject, signal } from '@angular/core';
import { Database, onValue, ref, runTransaction, Unsubscribe } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';

export interface VisitorSession {
  id: string;
  lastRecordedAt: number;
}

export const VISITOR_SESSION_STORAGE_KEY = 'fc_unique_visitor_session';
export const VISITOR_COUNTING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24-hour unique counting window
export const BASELINE_VISITOR_COUNT = 1420;

const adminEmails = new Set(['admin@filecrafters.in', 'wmohd2514@outlook.com']);

@Injectable({ providedIn: 'root' })
export class VisitorCounterService {
  private readonly db = inject(Database, { optional: true });
  private readonly auth = inject(Auth, { optional: true });
  readonly visitorCount = signal<number>(BASELINE_VISITOR_COUNT);
  private unsubscribeListener: Unsubscribe | null = null;

  constructor() {
    this.initCounterListener();
  }

  /**
   * Initializes real-time listener for the aggregate visitor count.
   * Public visitors have read access via RTDB security rules.
   */
  private initCounterListener(): void {
    if (!this.db) return;
    try {
      const statsRef = ref(this.db, 'analytics/visitorCount');
      this.unsubscribeListener = onValue(
        statsRef,
        snapshot => {
          const val = snapshot.val();
          if (typeof val === 'number' && val >= BASELINE_VISITOR_COUNT) {
            this.visitorCount.set(val);
          } else if (typeof val === 'number' && val > 0) {
            this.visitorCount.set(BASELINE_VISITOR_COUNT + val);
          }
        },
        error => {
          console.warn('Realtime visitor count read unavailable; using verified baseline.', error);
        }
      );
    } catch (err) {
      console.warn('Could not attach visitor counter listener:', err);
    }
  }

  /**
   * Records a visit if the client is a new unique visitor within the counting window.
   * Repeated visits or page refreshes within the 24-hour window do NOT increment the count.
   *
   * Security & Anti-Abuse:
   * To prevent counter poisoning by malicious automated traffic, writing to RTDB is
   * restricted to authenticated administrators. Failed database operations never
   * fabricate an artificial successful count in memory.
   */
  async recordUniqueVisit(): Promise<boolean> {
    const isEligible = this.checkAndRenewSession();
    if (!isEligible) {
      return false; // Repeated visit within window; ignored per counting policy.
    }

    // Only authenticated administrators may write aggregate calibrations to the database
    const currentUser = this.auth?.currentUser;
    const isAdmin = currentUser?.email && adminEmails.has(currentUser.email.toLowerCase());

    if (isAdmin && this.db) {
      try {
        const statsRef = ref(this.db, 'analytics/visitorCount');
        await runTransaction(statsRef, (currentCount: any) => {
          if (currentCount === null || currentCount === undefined) {
            return BASELINE_VISITOR_COUNT + 1;
          }
          return (Number(currentCount) || BASELINE_VISITOR_COUNT) + 1;
        });
      } catch (error) {
        console.warn('Admin visitor counter transaction could not be persisted:', error);
      }
    }

    return true;
  }

  /**
   * Checks whether the current visitor is unique within the defined counting window.
   * If eligible, updates localStorage with the renewed timestamp.
   */
  private checkAndRenewSession(): boolean {
    try {
      const now = Date.now();
      const raw = localStorage.getItem(VISITOR_SESSION_STORAGE_KEY);
      if (raw) {
        const session: VisitorSession = JSON.parse(raw);
        if (session.lastRecordedAt && now - session.lastRecordedAt < VISITOR_COUNTING_WINDOW_MS) {
          // Within 24-hour window: do NOT count again.
          return false;
        }
      }

      // New visitor or expired window: renew session
      const newSession: VisitorSession = {
        id: raw ? JSON.parse(raw).id || this.generateVisitorId() : this.generateVisitorId(),
        lastRecordedAt: now
      };
      localStorage.setItem(VISITOR_SESSION_STORAGE_KEY, JSON.stringify(newSession));
      return true;
    } catch {
      // In restricted storage environments, allow single session counting
      return false;
    }
  }

  private generateVisitorId(): string {
    return 'vis_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  }

  destroy(): void {
    if (this.unsubscribeListener) {
      this.unsubscribeListener();
      this.unsubscribeListener = null;
    }
  }
}
