import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm.component.html',
  styleUrls: ['./confirm.component.scss']
})
export class ConfirmComponent {
  private confirmService = inject(ConfirmService);
  state = this.confirmService.state;

  accept() {
    this.confirmService.accept();
  }

  cancel() {
    this.confirmService.cancel();
  }
}
