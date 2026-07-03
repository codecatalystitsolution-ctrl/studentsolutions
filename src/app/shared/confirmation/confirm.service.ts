import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  private _state = signal<ConfirmState>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Yes',
    cancelText: 'Cancel'
  });
  state = this._state.asReadonly();

  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmOptions): Promise<boolean> {
    if (this._state().open) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.resolver = resolve;
      this._state.set({
        open: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Yes',
        cancelText: options.cancelText || 'Cancel'
      });
    });
  }

  accept() {
    this.close();
    this.resolver?.(true);
    this.resolver = null;
  }

  cancel() {
    this.close();
    this.resolver?.(false);
    this.resolver = null;
  }

  private close() {
    this._state.update(current => ({ ...current, open: false }));
  }
}
