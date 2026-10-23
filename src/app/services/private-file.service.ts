import { Injectable, inject } from '@angular/core';
import { Storage, getBytes, ref } from '@angular/fire/storage';
import { NotificationService } from '../shared/notification/notification.service';

@Injectable({ providedIn: 'root' })
export class PrivateFileService {
  private storage = inject(Storage);
  private notifications = inject(NotificationService);

  async download(storagePath: string, fileName: string): Promise<boolean> {
    if (!storagePath) return false;
    try {
      const bytes = await getBytes(ref(this.storage, storagePath));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'project-file.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return true;
    } catch (error) {
      console.error('Private file download failed', error);
      this.notifications.show('error', 'This file could not be downloaded. Check your access and try again.', 'Download failed');
      return false;
    }
  }

  downloadLegacyDataUrl(dataUrl: string, fileName: string): boolean {
    if (!dataUrl?.startsWith('data:application/pdf')) return false;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName || 'uploaded-file.pdf';
    link.click();
    return true;
  }
}
