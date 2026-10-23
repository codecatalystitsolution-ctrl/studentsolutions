import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, get, onValue, push, ref, serverTimestamp, Unsubscribe, update } from '@angular/fire/database';
import { AuditTrailService } from './audit-trail.service';
import { NotificationInboxService } from './notification-inbox.service';

export interface SupportReply {
  ticketId: string;
  authorUid: string;
  authorEmail: string;
  authorRole: 'Admin' | 'Student';
  message: string;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class SupportReplyService {
  private readonly auth = inject(Auth);
  private readonly db = inject(Database);
  private readonly inbox = inject(NotificationInboxService);
  private readonly audit = inject(AuditTrailService);

  watchTicket(ticketId: string, next: (replies: Record<string, SupportReply>) => void): Unsubscribe {
    return onValue(ref(this.db, `supportReplies/${ticketId}`), snapshot => next(snapshot.val() || {}));
  }

  async addAdminReply(ticketId: string, message: string): Promise<void> {
    const actor = this.auth.currentUser;
    const normalizedMessage = message.trim();
    if (!actor || !ticketId || !normalizedMessage || normalizedMessage.length > 4000) {
      throw new Error('A signed-in administrator, ticket, and valid reply are required.');
    }
    const ticketSnapshot = await get(ref(this.db, `complaints/${ticketId}`));
    if (!ticketSnapshot.exists()) throw new Error('This support ticket no longer exists.');
    const ticket = ticketSnapshot.val();

    const replyRef = push(ref(this.db, `supportReplies/${ticketId}`));
    if (!replyRef.key) throw new Error('Could not allocate a support reply ID.');
    const reply: SupportReply = {
      ticketId,
      authorUid: actor.uid,
      authorEmail: actor.email || '',
      authorRole: 'Admin',
      message: normalizedMessage,
      createdAt: serverTimestamp() as unknown as number
    };

    await update(ref(this.db), {
      [`supportReplies/${ticketId}/${replyRef.key}`]: reply,
      [`complaints/${ticketId}/status`]: 'Resolved'
    });
    if (ticket.uid) {
      void this.inbox.notifyUser(ticket.uid, 'support', 'Support replied to your ticket', `An administrator replied to: ${String(ticket.subject || 'your support ticket').slice(0, 100)}.`, '/dashboard/my-tickets')
        .catch(error => console.warn('Support reply notification could not be delivered:', error));
    }
    void this.audit.recordAdmin('support_reply_added', 'ticket', ticketId, `Administrator added a support reply to ${ticketId}.`);
  }

  async addStudentReply(ticketId: string, message: string): Promise<void> {
    const actor = this.auth.currentUser;
    const normalizedMessage = message.trim();
    if (!actor || !ticketId || !normalizedMessage || normalizedMessage.length > 4000) throw new Error('A signed-in student and a valid reply are required.');
    const ticketSnapshot = await get(ref(this.db, `complaints/${ticketId}`));
    if (!ticketSnapshot.exists() || ticketSnapshot.val().uid !== actor.uid) throw new Error('You can only reply to your own support ticket.');
    const replyRef = push(ref(this.db, `supportReplies/${ticketId}`));
    if (!replyRef.key) throw new Error('Could not allocate a support reply ID.');
    await update(ref(this.db), {
      [`supportReplies/${ticketId}/${replyRef.key}`]: {
        ticketId,
        authorUid: actor.uid,
        authorEmail: actor.email || '',
        authorRole: 'Student',
        message: normalizedMessage,
        createdAt: serverTimestamp() as unknown as number
      } satisfies SupportReply,
      [`complaints/${ticketId}/status`]: 'In Progress'
    });
  }
}
