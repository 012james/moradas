import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import { InvoicesService } from '../../services/invoices/invoices.service';
import { InvoiceItem } from '../../shared/models/invoice.model';
import { RouterModule } from '@angular/router';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';


@Component({
  selector: 'app-meus-boletos',
  standalone: true,
  imports: [CommonModule, RouterModule, HasRoleDirective],
  templateUrl: './meus-boletos.component.html',
  styleUrls: ['./meus-boletos.component.scss']
})
export class MeusBoletosComponent {
  public authService = inject(AuthService);
  private invoicesService = inject(InvoicesService);

  copiedFeedback = '';

  private allInvoices$: Observable<InvoiceItem[]> = this.authService.currentUser$.pipe(
    switchMap((user) =>
      user?.status === 'approved' && user.houseNumber
        ? this.invoicesService.getInvoicesByHouse$(user.houseNumber)
        : of([])
    )
  );

  openInvoices$: Observable<InvoiceItem[]> = this.allInvoices$.pipe(
    map((list) => list.filter((i) => i.status !== 'pago'))
  );

  paidInvoices$: Observable<InvoiceItem[]> = this.allInvoices$.pipe(
    map((list) => list.filter((i) => i.status === 'pago'))
  );

  isOverdue(dueDate: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  }

  async copyCode(code: string, label: string): Promise<void> {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copiedFeedback = `${label} copiado para a área de transferência!`;
    setTimeout(() => (this.copiedFeedback = ''), 3200);
  }
}