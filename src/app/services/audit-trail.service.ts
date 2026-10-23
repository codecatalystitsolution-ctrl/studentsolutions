import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, onValue, push, query, ref, serverTimestamp, set, Unsubscribe, limitToLast } from '@angular/fire/database';

const adminEmails = new Set(['admin@filecrafters.in', 'wmohd2514@outlook.com']);

export interface AuditEvent {
  actorUid: string;
  actorEmail: string;
  actorRole: 'Admin';
  type: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class AuditTrailService {
  private readonly db = inject(Database);
  private readonly auth = inject(Auth);

  async recordAdmin(type: string, entityType: string, entityId: string, summary: string): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor?.email || !adminEmails.has(actor.email.toLowerCase())) return;
    const eventRef = push(ref(this.db, 'auditEvents'));
    if (!eventRef.key) return;
    const event: AuditEvent = {
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: 'Admin',
      type: type.trim().slice(0, 80),
      entityType: entityType.trim().slice(0, 50),
      entityId: entityId.trim().slice(0, 120),
      summary: summary.trim().slice(0, 500),
      createdAt: serverTimestamp() as unknown as number
    };
    try {
      await set(eventRef, event);
    } catch (error) {
      console.warn('Admin audit event could not be recorded:', error);
    }
  }

  watchRecent(next: (events: Array<AuditEvent & { id: string }>) => void): Unsubscribe {
    return onValue(query(ref(this.db, 'auditEvents'), limitToLast(100)), snapshot => {
      const value = snapshot.val() || {};
      next(Object.keys(value).map(id => ({ ...value[id], id })).sort((a, b) => b.createdAt - a.createdAt));
    });
  }
}
