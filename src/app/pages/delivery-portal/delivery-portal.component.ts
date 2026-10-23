import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Unsubscribe } from '@angular/fire/database';
import { DeliveryAssignment, DeliveryHistoryEvent, DeliveryStatus, DeliveryWorkflowService } from '../../services/delivery-workflow.service';
import { NotificationService } from '../../shared/notification/notification.service';

@Component({
  selector: 'app-delivery-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './delivery-portal.component.html',
  styleUrl: './delivery-portal.component.scss'
})
export class DeliveryPortalComponent implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly deliveryService = inject(DeliveryWorkflowService);
  private readonly notifications = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  assignments: DeliveryAssignment[] = [];
  history: Record<string, Record<string, any>> = {};
  notes: Record<string, string> = {};
  loading = true;
  private stopAssignments: Unsubscribe | null = null;
  private historySubscriptions = new Map<string, Unsubscribe>();

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {
      this.stopAssignments?.();
      if (!user) {
        this.assignments = [];
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
      this.stopAssignments = this.deliveryService.watchAgentAssignments(user.uid, assignments => {
        this.assignments = assignments.sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
        this.loading = false;
        for (const assignment of assignments) this.watchHistory(assignment.orderId);
        this.cdr.detectChanges();
      });
    });
  }

  nextStatus(status: DeliveryStatus): DeliveryStatus | null {
    const next: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
      assigned: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
      failed_delivery: 'in_transit'
    };
    return next[status] || null;
  }

  async update(assignment: DeliveryAssignment): Promise<void> {
    const next = this.nextStatus(assignment.status);
    if (!next) return;
    const note = this.notes[assignment.orderId] || '';
    this.notes[assignment.orderId] = '';
    try {
      const historyEvent = await this.deliveryService.updateStatus(assignment.orderId, next, note);
      this.zone.run(() => {
        this.history[assignment.orderId] = {
          ...(this.history[assignment.orderId] || {}),
          [historyEvent.id]: historyEvent as DeliveryHistoryEvent
        };
      });
      this.notifications.show('success', `Order status updated to ${next.replace('_', ' ')}.`, 'Delivery Updated');
    } catch (error) {
      this.notes[assignment.orderId] = note;
      console.error('Delivery update failed:', error);
      this.notifications.show('error', 'The assignment could not be updated. Check that it is still assigned to you.', 'Update Failed');
    }
  }

  statusLabel(status: string): string { return status.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }

  private watchHistory(orderId: string): void {
    if (this.historySubscriptions.has(orderId)) return;
    this.historySubscriptions.set(orderId, this.deliveryService.watchHistory(orderId, value => {
      this.history[orderId] = value;
      this.cdr.detectChanges();
    }));
  }

  ngOnDestroy(): void {
    this.stopAssignments?.();
    this.historySubscriptions.forEach(unsubscribe => unsubscribe());
  }
}
