import { Injectable, inject } from '@angular/core';
import { Database, ref, onValue, update, remove, Unsubscribe } from '@angular/fire/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupportReply, SupportReplyService } from '../../../services/support-reply.service';

@Injectable({
  providedIn: 'root'
})
export class ComplaintsService {
  private db = inject(Database);
  private replies = inject(SupportReplyService);

  constructor() { }

  getComplaints(): Observable<any[]> {
    const complaintsRef = ref(this.db, 'complaints');
    return new Observable<any[]>(observer => {
      const unsubscribe = onValue(complaintsRef, (snapshot) => {
        const data = snapshot.val();
        const complaints: any[] = [];
        if (data) {
          Object.keys(data).forEach(key => {
            complaints.push({ id: key, ...data[key] });
          });
        }
        observer.next(complaints);
      }, (error) => {
        observer.error(error);
      });
      return unsubscribe;
    }).pipe(
      map((complaints: any[]) => complaints.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    );
  }

  updateComplaintStatus(id: string, status: string): Promise<void> {
    return update(ref(this.db, `complaints/${id}`), { status });
  }

  sendReply(id: string, adminReply: string): Promise<void> {
    return this.replies.addAdminReply(id, adminReply);
  }

  watchReplies(id: string, next: (replies: Record<string, SupportReply>) => void): Unsubscribe {
    return this.replies.watchTicket(id, next);
  }

  deleteComplaint(id: string): Promise<void> {
    return remove(ref(this.db, `complaints/${id}`));
  }
}
