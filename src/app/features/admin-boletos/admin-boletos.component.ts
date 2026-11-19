import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { UserProfile } from '../../shared/models/user.model';
import { AuthService } from '../../services/auth/auth.service';
import { InvoicesService } from '../../services/invoices/invoices.service';
import { NotificationService } from '../../services/notification/notification.service';
import { InvoiceExtraCharge, InvoiceItem } from '../../shared/models/invoice.model';
import { ReservationItem } from '../../shared/models/reservation.model';


@Component({
  selector: 'app-admin-boletos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-boletos.component.html',
  styleUrls: ['./admin-boletos.component.scss']
})
export class AdminBoletosComponent implements OnInit, OnDestroy {
  private invoicesService = inject(InvoicesService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private sub?: Subscription;

  pendingHouseReservations: ReservationItem[] = [];
  includeExtrasIndividual = true;
  includeExtrasInBatch = true;
  reservationsCutoffDate = '';

  // Modo de Operação: Individual (1 Casa) ou Lote Mensal (Todas as Casas Aprovadas)
  emitMode: 'individual' | 'lote' = 'individual';

  // Campos Comuns e Individuais
  houseNumber: number | null = null;
  houseResidents: UserProfile[] = [];
  recipientName = '';
  referenceMonth = 'Dezembro / 2026';
  amount = 380;
  dueDate = '';
  barcode = '';
  pixCode = '';
  pdfUrl = '';
  notes = 'Taxa condominial ordinária mensal';
  openWhatsAppAfterSave = true;

  // Opções específicas do Lote Mensal
  sendBatchEmailOnGenerate = true;
  openMailClientOnBatch = false;

  isSubmitting = false;
  toastMsg = '';

  // Lista de Boletos Emitidos
  allInvoices: InvoiceItem[] = [];
  searchTerm = '';
  statusFilter: 'todos' | 'aberto' | 'pago' = 'aberto';

  ngOnInit(): void {
    this.sub = this.invoicesService.getAllInvoices$().subscribe((list) => {
      this.allInvoices = list;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get individualExtrasTotal(): number {
    if (!this.includeExtrasIndividual) return 0;
    return this.pendingHouseReservations.reduce((acc, r) => acc + Number(r.feeSnapshot), 0);
  }

  get finalIndividualPreview(): number {
    return (Number(this.amount) || 0) + this.individualExtrasTotal;
  }

  // Substitua onHouseChange():
  async onHouseChange(): Promise<void> {
    if (!this.houseNumber || this.houseNumber < 1 || this.houseNumber > 600) {
      this.houseResidents = [];
      this.pendingHouseReservations = [];
      return;
    }

    const [residents, unbilled] = await Promise.all([
      this.notificationService.getApprovedResidentsByHouse(this.houseNumber),
      this.invoicesService.getUnbilledReservationsByHouse(this.houseNumber)
    ]);

    this.houseResidents = residents;
    this.pendingHouseReservations = unbilled;

    if (this.houseResidents.length > 0 && !this.recipientName.trim()) {
      this.recipientName = this.houseResidents[0]['name'] as unknown as string;
    }
  }

  // Substitua onEmitInvoice():
  async onEmitInvoice(): Promise<void> {
    if (
      !this.houseNumber ||
      !this.recipientName.trim() ||
      !this.referenceMonth.trim() ||
      !this.dueDate ||
      !this.barcode.trim()
    ) {
      return;
    }

    this.isSubmitting = true;
    try {
      const sindico = await firstValueFrom(this.authService.currentUser$);
      if (!sindico) return;

      const extraCharges: InvoiceExtraCharge[] = this.includeExtrasIndividual
        ? this.pendingHouseReservations.map((r) => ({
            reservationId: r.id,
            description: `${r.spaceName} (${r.date.split('-').reverse().slice(0, 2).join('/')})`,
            amount: Number(r.feeSnapshot)
          }))
        : [];

      const created = await this.invoicesService.createInvoice(
        {
          houseNumber: this.houseNumber,
          recipientName: this.recipientName,
          referenceMonth: this.referenceMonth,
          baseAmount: this.amount,
          extraCharges,
          dueDate: this.dueDate,
          barcode: this.barcode,
          pixCode: this.pixCode,
          pdfUrl: this.pdfUrl,
          notes: this.notes
        },
        sindico
      );

      await this.notificationService.sendInvoiceEmail(created, false);

      if (this.openWhatsAppAfterSave) {
        await this.notificationService.shareInvoiceOnWhatsApp(created);
      }

      this.showToast(
        `Casa ${created.houseNumber} emitida no valor de R$ ${created.amount.toFixed(2)}!`
      );
      this.houseNumber = null;
      this.houseResidents = [];
      this.pendingHouseReservations = [];
      this.recipientName = '';
      this.barcode = '';
      this.pdfUrl = '';
    } finally {
      this.isSubmitting = false;
    }
  }

  // Substitua onEmitBulkInvoices():
  async onEmitBulkInvoices(): Promise<void> {
    if (!this.referenceMonth.trim() || !this.dueDate || !this.amount) {
      return;
    }

    this.isSubmitting = true;
    try {
      const sindico = await firstValueFrom(this.authService.currentUser$);
      if (!sindico) return;

      const result = await this.invoicesService.generateBulkInvoicesForApprovedHouses(
        {
          referenceMonth: this.referenceMonth,
          amount: this.amount,
          dueDate: this.dueDate,
          pixCode: this.pixCode,
          barcodePrefix: this.barcode,
          notes: this.notes,
          includeUnbilledReservations: this.includeExtrasInBatch,
          reservationsCutoffDate: this.reservationsCutoffDate || undefined
        },
        sindico
      );

      if (this.sendBatchEmailOnGenerate && result.notifiedEmails.length > 0) {
        await this.notificationService.sendBulkInvoiceBatchEmail(
          result.notifiedEmails,
          {
            referenceMonth: this.referenceMonth,
            amount: this.amount,
            dueDate: this.dueDate,
            pixCode: this.pixCode,
            notes: this.notes
          },
          this.openMailClientOnBatch
        );
      }

      if (result.createdCount === 0 && result.skippedCount > 0) {
        this.showToast(
          `Todas as ${result.skippedCount} casas aprovadas já possuem boleto em ${this.referenceMonth}.`
        );
      } else {
        const extraInfo =
          result.housesWithExtrasCount > 0
            ? ` • ${result.housesWithExtrasCount} casa(s) tiveram taxas de lazer somadas (+R$ ${result.totalExtrasAmount.toFixed(2)})`
            : '';
        this.showToast(`Lote gerado para ${result.createdCount} casas${extraInfo}!`);
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  get filteredInvoices(): InvoiceItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.allInvoices
      .filter((i) =>
        this.statusFilter === 'todos' ? true : i.status === this.statusFilter
      )
      .filter(
        (i) =>
          !term ||
          String(i.houseNumber).includes(term) ||
          i.recipientName.toLowerCase().includes(term) ||
          i.referenceMonth.toLowerCase().includes(term)
      );
  }

  async sendWhatsApp(inv: InvoiceItem): Promise<void> {
    await this.notificationService.shareInvoiceOnWhatsApp(inv);
  }

  async sendEmail(inv: InvoiceItem): Promise<void> {
    const res = await this.notificationService.sendInvoiceEmail(inv, true);
    this.showToast(
      res.totalRecipients > 0
        ? `E-mail enviado para a Casa ${inv.houseNumber}!`
        : `Casa ${inv.houseNumber} sem e-mail aprovado.`
    );
  }

  async confirmPayment(inv: InvoiceItem): Promise<void> {
    await this.invoicesService.markAsPaid(inv.id);
    this.showToast(`Mensalidade da Casa ${inv.houseNumber} marcada como PAGA!`);
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    setTimeout(() => (this.toastMsg = ''), 4500);
  }
}