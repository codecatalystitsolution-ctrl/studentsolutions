import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, equalTo, get, limitToFirst, onValue, orderByChild, push, query, ref, set, Unsubscribe, update } from '@angular/fire/database';
import { AuditTrailService } from './audit-trail.service';
import { NotificationInboxService } from './notification-inbox.service';

export type DeliveryStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed_delivery';
export interface DeliveryHistoryEvent {
  id: string;
  orderId: string;
  agentUid: string;
  actorUid: string;
  actorEmail: string;
  status: DeliveryStatus;
  note: string;
  createdAt: string;
}

export interface DeliveryAssignment {
  orderId: string;
  uid: string;
  agentUid: string;
  status: DeliveryStatus;
  assignedAt: string;
  assignedBy: string;
  studentName: string;
  subject: string;
  phone: string;
  address: string;
  pincode: string;
  lastHistoryEventId?: string;
  lastHistoryStatus?: DeliveryStatus;
  lastHistoryActorUid?: string;
  lastHistoryActorEmail?: string;
  lastHistoryNote?: string;
  lastHistoryCreatedAt?: string;
  updatedAt?: string;
  lastNote?: string;
}

@Injectable({ providedIn: 'root' })
export class DeliveryWorkflowService {
  private readonly db = inject(Database);
  private readonly auth = inject(Auth);
  private readonly inbox = inject(NotificationInboxService);
  private readonly audit = inject(AuditTrailService);

  async assign(order: any, agentUid: string): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor || !order?.id || !order.uid || !agentUid) throw new Error('Order, student, delivery agent, and administrator are required.');
    const [orderSnap, agentSnap] = await Promise.all([
      get(ref(this.db, `orders/${order.id}`)),
      get(ref(this.db, `users/${agentUid}`))
    ]);
    const currentOrder = orderSnap.val();
    const agent = agentSnap.val();
    if (!currentOrder || currentOrder.uid !== order.uid || !agent || agent.role !== 'Delivery' || agent.status !== 'active') {
      throw new Error('The order or active delivery agent could not be validated.');
    }
    if (['Cancelled', 'Delivered'].includes(currentOrder.status)) throw new Error('This order is not eligible for delivery assignment.');

    const assignmentRef = ref(this.db, `deliveryAssignments/${order.id}`);
    const previousSnap = await get(assignmentRef);
    const previous = previousSnap.exists() ? previousSnap.val() as DeliveryAssignment : null;
    if (previous?.status === 'delivered' && previous.agentUid !== agentUid) {
      throw new Error('A delivered assignment is closed and cannot be reassigned. Review its tracking history manually.');
    }
    if (previous?.agentUid === agentUid) {
      await this.ensureLastHistoryEvent(order.id, previous);
      return;
    }
    if (previous) await this.ensureLastHistoryEvent(order.id, previous);

    const assignedAt = new Date().toISOString();
    const eventRef = push(ref(this.db, `deliveryHistory/${order.id}`));
    if (!eventRef.key) throw new Error('Could not allocate a delivery assignment history event.');

    const assignment: DeliveryAssignment = {
      orderId: order.id,
      uid: order.uid,
      agentUid,
      status: 'assigned',
      assignedAt,
      assignedBy: actor.uid,
      studentName: currentOrder.projectDetails?.submittedBy || currentOrder.userDetails?.fullName || 'Student',
      subject: currentOrder.projectDetails?.subject || 'Student order',
      phone: currentOrder.userDetails?.phone || currentOrder.phone || '',
      address: currentOrder.userDetails?.address || currentOrder.address || '',
      pincode: currentOrder.userDetails?.pincode || currentOrder.pincode || '',
      lastHistoryEventId: eventRef.key,
      lastHistoryStatus: 'assigned',
      lastHistoryActorUid: actor.uid,
      lastHistoryActorEmail: actor.email || '',
      lastHistoryNote: 'Delivery assignment created by administrator.',
      lastHistoryCreatedAt: assignedAt
    };
    try {
      await set(assignmentRef, assignment);
    } catch (error) {
      const committed = await get(assignmentRef).catch(() => null);
      const latest = committed?.exists() ? committed.val() as DeliveryAssignment : null;
      if (!latest || latest.lastHistoryEventId !== eventRef.key) throw error;
      await this.ensureLastHistoryEvent(order.id, latest);
      return;
    }
    await this.ensureLastHistoryEvent(order.id, assignment);
    void this.inbox.notifyUser(order.uid, 'delivery', 'Delivery assigned', `A delivery agent has been assigned to order ${order.id.slice(0, 8)}.`, '/dashboard/my-orders')
      .catch(error => console.warn('Student delivery notification could not be delivered:', error));
    void this.inbox.notifyUser(agentUid, 'delivery', 'New delivery assignment', `You have a new delivery assignment for order ${order.id.slice(0, 8)}.`, '/delivery-portal')
      .catch(error => console.warn('Delivery agent notification could not be delivered:', error));
    void this.audit.recordAdmin('delivery_assigned', 'order', order.id, `Delivery assigned to agent ${agentUid}.`);
  }

  async updateStatus(orderId: string, status: DeliveryStatus, note: string): Promise<DeliveryHistoryEvent> {
    const actor = this.auth.currentUser;
    if (!actor) throw new Error('Sign in to update an assigned delivery.');
    const assignmentRef = ref(this.db, `deliveryAssignments/${orderId}`);
    const assignmentSnap = await get(assignmentRef);
    if (!assignmentSnap.exists()) throw new Error('Delivery assignment not found.');
    const assignment = assignmentSnap.val() as DeliveryAssignment;
    if (assignment.agentUid !== actor.uid) throw new Error('Only the assigned delivery agent can update this delivery.');
    const recovered = await this.ensureLastHistoryEvent(orderId, assignment, actor.uid, actor.email || '');
    const reconciledAssignment = recovered.assignment;
    if (reconciledAssignment.status === status) {
      return recovered.event;
    }
    const allowedNext: Record<DeliveryStatus, DeliveryStatus[]> = {
      assigned: ['picked_up'],
      picked_up: ['in_transit'],
      in_transit: ['delivered', 'failed_delivery'],
      failed_delivery: ['in_transit'],
      delivered: []
    };
    if (!allowedNext[reconciledAssignment.status]?.includes(status)) throw new Error(`Invalid delivery transition: ${reconciledAssignment.status} to ${status}.`);
    const timestamp = new Date().toISOString();
    const eventRef = push(ref(this.db, `deliveryHistory/${orderId}`));
    if (!eventRef.key) throw new Error('Could not allocate a delivery status history event.');
    const normalizedNote = note.trim().slice(0, 1000) || `Delivery status changed to ${status.replace('_', ' ')}.`;
    const historyProjection: Partial<DeliveryAssignment> = {
      status,
      updatedAt: timestamp,
      lastNote: normalizedNote,
      lastHistoryEventId: eventRef.key,
      lastHistoryStatus: status,
      lastHistoryActorUid: actor.uid,
      lastHistoryActorEmail: actor.email || '',
      lastHistoryNote: normalizedNote,
      lastHistoryCreatedAt: timestamp
    };
    try {
      await update(ref(this.db), Object.fromEntries(
        Object.entries(historyProjection).map(([field, value]) => [`deliveryAssignments/${orderId}/${field}`, value])
      ));
    } catch (error) {
      const committed = await get(assignmentRef).catch(() => null);
      const latest = committed?.exists() ? committed.val() as DeliveryAssignment : null;
      if (!latest || latest.lastHistoryEventId !== eventRef.key) throw error;
      return (await this.ensureLastHistoryEvent(orderId, latest, actor.uid, actor.email || '')).event;
    }
    return (await this.ensureLastHistoryEvent(orderId, { ...reconciledAssignment, ...historyProjection }, actor.uid, actor.email || '')).event;
  }

  watchAgentAssignments(agentUid: string, next: (assignments: Array<DeliveryAssignment>) => void): Unsubscribe {
    const assignmentsQuery = query(ref(this.db, 'deliveryAssignments'), orderByChild('agentUid'), equalTo(agentUid), limitToFirst(100));
    return onValue(assignmentsQuery, snapshot => {
      const value = snapshot.val() || {};
      next(Object.keys(value).map(orderId => ({ ...value[orderId], orderId })));
    });
  }

  watchAssignment(orderId: string, next: (assignment: DeliveryAssignment | null) => void): Unsubscribe {
    return onValue(ref(this.db, `deliveryAssignments/${orderId}`), snapshot => next(snapshot.exists() ? snapshot.val() as DeliveryAssignment : null));
  }

  watchHistory(orderId: string, next: (history: Record<string, any>) => void): Unsubscribe {
    return onValue(ref(this.db, `deliveryHistory/${orderId}`), snapshot => next(snapshot.val() || {}));
  }

  private async ensureLastHistoryEvent(
    orderId: string,
    assignment: DeliveryAssignment,
    fallbackActorUid = this.auth.currentUser?.uid || '',
    fallbackActorEmail = this.auth.currentUser?.email || ''
  ): Promise<{ assignment: DeliveryAssignment; event: DeliveryHistoryEvent }> {
    if (!assignment.lastHistoryEventId || !assignment.lastHistoryStatus || !assignment.lastHistoryActorUid
      || !assignment.lastHistoryActorEmail || !assignment.lastHistoryCreatedAt) {
      if (!fallbackActorUid || !fallbackActorEmail) throw new Error('Delivery history reconciliation needs an authenticated actor.');
      const eventRef = push(ref(this.db, `deliveryHistory/${orderId}`));
      if (!eventRef.key) throw new Error('Could not allocate a legacy delivery history event.');
      const timestamp = new Date().toISOString();
      const note = 'Legacy assignment history reconciled; earlier event details were unavailable.';
      const projection: Partial<DeliveryAssignment> = {
        lastHistoryEventId: eventRef.key,
        lastHistoryStatus: assignment.status,
        lastHistoryActorUid: fallbackActorUid,
        lastHistoryActorEmail: fallbackActorEmail,
        lastHistoryNote: note,
        lastHistoryCreatedAt: timestamp
      };
      await update(ref(this.db), Object.fromEntries(
        Object.entries(projection).map(([field, value]) => [`deliveryAssignments/${orderId}/${field}`, value])
      ));
      assignment = { ...assignment, ...projection };
    }
    const eventId = assignment.lastHistoryEventId;
    if (!eventId || !assignment.lastHistoryStatus || !assignment.lastHistoryActorUid || !assignment.lastHistoryActorEmail) throw new Error('Delivery history reconciliation needs manual review for this assignment.');
    const eventRef = ref(this.db, `deliveryHistory/${orderId}/${eventId}`);
    const existing = await get(eventRef);
    if (existing.exists()) {
      const savedEvent = existing.val();
      if (savedEvent.status !== assignment.lastHistoryStatus || savedEvent.agentUid !== assignment.agentUid
        || savedEvent.actorUid !== assignment.lastHistoryActorUid || savedEvent.actorEmail !== assignment.lastHistoryActorEmail) {
        throw new Error('Delivery history conflicts with the saved assignment state; manual review is required.');
      }
      return { assignment, event: { ...savedEvent, id: eventId } as DeliveryHistoryEvent };
    }
    const event = {
      orderId,
      agentUid: assignment.agentUid,
      actorUid: assignment.lastHistoryActorUid,
      actorEmail: assignment.lastHistoryActorEmail,
      status: assignment.lastHistoryStatus,
      note: (assignment.lastHistoryNote || '').slice(0, 1000),
      createdAt: assignment.lastHistoryCreatedAt || assignment.updatedAt || assignment.assignedAt
    };
    try {
      await set(eventRef, event);
    } catch (error) {
      const committed = await get(eventRef).catch(() => null);
      if (!committed?.exists()) throw error;
      const savedEvent = committed.val();
      if (savedEvent.status !== event.status || savedEvent.agentUid !== event.agentUid
        || savedEvent.actorUid !== event.actorUid || savedEvent.actorEmail !== event.actorEmail) {
        throw new Error('Delivery history recovery found a conflicting event.', { cause: error });
      }
      return { assignment, event: { ...savedEvent, id: eventId } as DeliveryHistoryEvent };
    }
    return { assignment, event: { ...event, id: eventId } };
  }
}
