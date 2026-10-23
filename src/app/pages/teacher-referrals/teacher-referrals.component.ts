import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Unsubscribe } from '@angular/fire/database';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommissionRecord, ReferralAttribution, ReferralCode, ReferralCommissionService } from '../../services/referral-commission.service';

@Component({
  selector: 'app-teacher-referrals',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './teacher-referrals.component.html',
  styleUrl: './teacher-referrals.component.scss'
})
export class TeacherReferralsComponent implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly referrals = inject(ReferralCommissionService);
  private readonly cdr = inject(ChangeDetectorRef);
  codes: ReferralCode[] = [];
  students: ReferralAttribution[] = [];
  commissions: Array<CommissionRecord & { id: string }> = [];
  histories: Record<string, Record<string, any>> = {};
  loading = true;
  private authSubscription?: Subscription;
  private stops: Unsubscribe[] = [];
  private historyStops = new Map<string, Unsubscribe>();

  ngOnInit(): void {
    this.authSubscription = authState(this.auth).subscribe(user => {
      this.stopListeners();
      if (!user) {
        this.loading = false;
        this.codes = [];
        this.students = [];
        this.commissions = [];
        return;
      }
      this.stops = [
        this.referrals.watchCodesForTeacher(user.uid, value => { this.codes = value; this.cdr.detectChanges(); }),
        this.referrals.watchMyAttributions(user.uid, value => { this.students = value; this.loading = false; this.cdr.detectChanges(); }),
        this.referrals.watchMyCommissions(user.uid, value => {
          this.commissions = value;
          this.loading = false;
          for (const commission of value) this.watchHistory(commission.id);
          this.cdr.detectChanges();
        })
      ];
    });
  }

  statusLabel(status: string): string {
    return status.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  private watchHistory(commissionId: string): void {
    if (this.historyStops.has(commissionId)) return;
    this.historyStops.set(commissionId, this.referrals.watchCommissionHistory(commissionId, history => {
      this.histories[commissionId] = history;
      this.cdr.detectChanges();
    }));
  }

  private stopListeners(): void {
    this.stops.forEach(stop => stop());
    this.stops = [];
    this.historyStops.forEach(stop => stop());
    this.historyStops.clear();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.stopListeners();
  }
}
