import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { UserProfile } from '../../shared/models/user.model';
import { AuthService } from '../../services/auth/auth.service';
import { ReservationsService } from '../../services/reservations/reservations.service';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { CondoSpaceConfig, ReservationItem, SpaceId } from '../../shared/models/reservation.model';


@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, HasRoleDirective],
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.scss']
})
export class ReservasComponent implements OnInit, OnDestroy {
  private reservationsService = inject(ReservationsService);
  public authService = inject(AuthService);

  private spacesSub?: Subscription;
  private resSub?: Subscription;
  private userSub?: Subscription;

  currentUser: UserProfile | null = null;
  spaces: CondoSpaceConfig[] = [];
  allReservations: ReservationItem[] = [];

  selectedSpaceId: SpaceId = 'salao_festas';
  selectedDate = '';
  acceptedTerms = false;

  viewTab: 'reservar' | 'minhas' | 'agenda_portaria' = 'reservar';

  // Modo de Edição de Taxas e Regras (Exclusivo Síndico)
  editingConfig = false;
  editableSpaces: CondoSpaceConfig[] = [];
  editableRulesText: Record<string, string> = {};

  isSubmitting = false;
  toastMsg = '';
  errorMsg = '';

  readonly minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Amanhã

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe((u) => {
      this.currentUser = u;
    });

    this.spacesSub = this.reservationsService.getSpacesConfig$().subscribe((list) => {
      this.spaces = list;
    });

    this.resSub = this.reservationsService.getAllReservations$().subscribe((list) => {
      this.allReservations = list;
    });
  }

  ngOnDestroy(): void {
    this.spacesSub?.unsubscribe();
    this.resSub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  get activeSpace(): CondoSpaceConfig | undefined {
    return this.spaces.find((s) => s.id === this.selectedSpaceId) || this.spaces[0];
  }

  // Verifica se a data escolhida já está ocupada no espaço selecionado
  get conflictReservation(): ReservationItem | undefined {
    if (!this.selectedDate || !this.activeSpace) return undefined;
    return this.allReservations.find(
      (r) => r.spaceId === this.activeSpace!.id && r.date === this.selectedDate
    );
  }

  // Próximas datas já ocupadas deste espaço (exibe para o morador não escolher no escuro)
  get occupiedDatesForActiveSpace(): ReservationItem[] {
    return this.allReservations
      .filter((r) => r.spaceId === this.selectedSpaceId)
      .slice(0, 6);
  }

  // Reservas apenas da casa do morador logado
  get myHouseReservations(): ReservationItem[] {
    if (!this.currentUser?.['houseNumber']) return [];
    return this.allReservations.filter(
      (r) => Number(r.houseNumber) === Number(this.currentUser!['houseNumber'])
    );
  }

  selectSpace(id: SpaceId): void {
    this.selectedSpaceId = id;
    this.acceptedTerms = false;
    this.errorMsg = '';
  }

  async onConfirmReservation(): Promise<void> {
    this.errorMsg = '';
    const space = this.activeSpace;
    if (!space || !this.selectedDate || !this.acceptedTerms) return;

    if (this.selectedDate < this.minDate) {
      this.errorMsg = 'Selecione uma data futura a partir de amanhã.';
      return;
    }

    if (this.conflictReservation) {
      this.errorMsg = 'Este espaço já está reservado para a data selecionada.';
      return;
    }

    this.isSubmitting = true;
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user || user.status !== 'approved') {
        this.errorMsg = 'Sua unidade precisa estar aprovada pelo síndico para reservar.';
        return;
      }

      const created = await this.reservationsService.createReservation(
        space,
        this.selectedDate,
        user
      );

      this.selectedDate = '';
      this.acceptedTerms = false;
      this.viewTab = 'minhas';
      this.showToast(`${created.spaceName} reservado com sucesso para a Casa ${created.houseNumber}!`);
    } catch (err: any) {
      this.errorMsg = err?.message || 'Não foi possível concluir a reserva.';
    } finally {
      this.isSubmitting = false;
    }
  }

  canCancel(item: ReservationItem): boolean {
    if (this.currentUser?.['role'] === 'sindico') return true;
    const spaceCfg = this.spaces.find((s) => s.id === item.spaceId);
    const minHours = spaceCfg?.cancellationHours || 24;
    const eventTime = new Date(`${item.date}T09:00:00`).getTime();
    const diffHours = (eventTime - Date.now()) / (1000 * 60 * 60);
    return diffHours >= minHours;
  }

  async onCancelReservation(item: ReservationItem): Promise<void> {
    if (!this.canCancel(item)) {
      this.errorMsg = 'Prazo limite de cancelamento gratuito encerrado. Contate a Secretaria.';
      return;
    }
    await this.reservationsService.cancelReservation(item.id);
    this.showToast('Reserva cancelada e data liberada no calendário.');
  }

  // Comprovante formatado para o morador encaminhar no WhatsApp ou à Portaria
  shareVoucherOnWhatsApp(item: ReservationItem): void {
    const formattedDate = item.date.split('-').reverse().join('/');
    const formattedFee = item.feeSnapshot.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    const text = [
      `🎉 *COMPROVANTE DE RESERVA — Condomínio Moradas*`,
      ``,
      `• *Espaço:* ${item.spaceName}`,
      `• *Data:* ${formattedDate}`,
      `• *Unidade:* Casa ${item.houseNumber} (${item.residentName})`,
      `• *Taxa de uso:* ${formattedFee} (lançada no próximo boleto)`,
      ``,
      `_Lembre-se de enviar a lista de convidados à Portaria com antecedência._`
    ].join('\n');

    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  // --- EDIÇÃO DE VALORES E REGRAS PELO SÍNDICO ---
  startEditingSpaces(): void {
    this.editableSpaces = JSON.parse(JSON.stringify(this.spaces));
    this.editableRulesText = {};
    this.editableSpaces.forEach((s) => {
      this.editableRulesText[s.id] = s.rules.join('\n');
    });
    this.editingConfig = true;
  }

  async saveSpacesSettings(): Promise<void> {
    if (!this.currentUser) return;
    this.isSubmitting = true;
    try {
      const updated = this.editableSpaces.map((s) => ({
        ...s,
        fee: Number(s.fee) || 0,
        capacity: Number(s.capacity) || 1,
        cancellationHours: Number(s.cancellationHours) || 24,
        rules: (this.editableRulesText[s.id] || '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      }));

      await this.reservationsService.saveSpacesConfig(updated, this.currentUser);
      this.editingConfig = false;
      this.showToast('Valores e regras dos espaços atualizados!');
    } finally {
      this.isSubmitting = false;
    }
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    setTimeout(() => (this.toastMsg = ''), 4000);
  }
}