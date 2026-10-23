import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Unsubscribe } from '@angular/fire/database';
import { AuditEvent, AuditTrailService } from '../../../services/audit-trail.service';

@Component({
  selector: 'app-audit-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit-history.component.html',
  styleUrl: './audit-history.component.scss'
})
export class AuditHistoryComponent implements OnInit, OnDestroy {
  private readonly auditTrail = inject(AuditTrailService);
  events: Array<AuditEvent & { id: string }> = [];
  loading = true;
  private stop: Unsubscribe | null = null;

  ngOnInit(): void {
    this.stop = this.auditTrail.watchRecent(events => {
      this.events = events;
      this.loading = false;
    });
  }

  ngOnDestroy(): void { this.stop?.(); }
}
