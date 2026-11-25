import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { UserProfile } from '../../shared/models/user.model';
import { AuthService } from '../../services/auth/auth.service';
import { VisitorsService } from '../../services/visitors/visitors.service';
import { VisitorAuthorization, VisitorAccessType, VisitorCategory } from '../../shared/models/visitor.model';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-meus-visitantes',
  standalone: true,
  imports: [CommonModule, FormsModule, HasRoleDirective, RouterLink],
  templateUrl: './meus-visitantes.component.html',
  styleUrls: ['./meus-visitantes.component.scss']
})
export class MeusVisitantesComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private visitorsService = inject(VisitorsService);
  private userSub?: Subscription;
  private visSub?: Subscription;

  currentUser: UserProfile | null = null;
  allHouseVisitors: VisitorAuthorization[] = [];

  activeTab: VisitorAccessType = 'unico';

  readonly todayStr = this.getTodayLocalISO();
  readonly categories: VisitorCategory[] = [
    'Convidado / Familiar',
    'Prestador de Serviço',
    'Diarista / Fixo'
  ];

  // Campos do Formulário
  visitorName = '';
  category: VisitorCategory = 'Convidado / Familiar';
  vehiclePlate = '';
  visitorDoc = '';
  validDate = this.todayStr;
  notes = '';

  isSaving = false;
  toastMsg = '';
  errorMsg = '';

  private getTodayLocalISO(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get isPastDate(): boolean {
    return this.activeTab === 'unico' && (!this.validDate || this.validDate < this.todayStr);
  }

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      this.visSub?.unsubscribe();

      if (user?.status === 'approved' && user.houseNumber) {
        this.visSub = this.visitorsService
          .getVisitorsByHouse$(user.houseNumber)
          .subscribe((list) => {
            this.allHouseVisitors = list;
          });
      }
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.visSub?.unsubscribe();
  }

  // Liberações avulsas do dia ou futuras (inclui as que entraram hoje para transparência)
  get dayPasses(): VisitorAuthorization[] {
    return this.allHouseVisitors.filter(
      (v) => v.accessType === 'unico' && (v.validDate || '') >= this.todayStr
    );
  }

  // Lista fixa de acesso recorrente da casa
  get permanentList(): VisitorAuthorization[] {
    return this.allHouseVisitors.filter((v) => v.accessType === 'permanente');
  }

  switchTab(tab: VisitorAccessType): void {
    this.activeTab = tab;
    this.errorMsg = '';
    if (tab === 'permanente') {
      this.category = 'Diarista / Fixo';
    } else {
      this.category = 'Convidado / Familiar';
      if (!this.validDate || this.validDate < this.todayStr) {
        this.validDate = this.todayStr;
      }
    }
  }

  async onAuthorize(): Promise<void> {
    this.errorMsg = '';
    if (!this.visitorName.trim()) return;

    if (this.isPastDate) {
      this.errorMsg = 'Não é possível liberar visitas para datas anteriores a hoje.';
      return;
    }

    this.isSaving = true;

    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user || user.status !== 'approved') return;

      await this.visitorsService.authorizeVisitor(
        {
          visitorName: this.visitorName,
          visitorDoc: this.visitorDoc,
          vehiclePlate: this.vehiclePlate,
          category: this.category,
          accessType: this.activeTab,
          validDate: this.validDate,
          notes: this.notes
        },
        user
      );

      this.toastMsg =
        this.activeTab === 'unico'
          ? `${this.visitorName} liberado(a) na portaria!`
          : `${this.visitorName} adicionado(a) à Lista Permanente da casa!`;

      this.visitorName = '';
      this.vehiclePlate = '';
      this.visitorDoc = '';
      this.validDate = this.todayStr;
      this.notes = '';
      setTimeout(() => (this.toastMsg = ''), 3500);
    } finally {
      this.isSaving = false;
    }
  }

  async togglePermanent(item: VisitorAuthorization): Promise<void> {
    await this.visitorsService.togglePermanentActive(item.id, !item.active);
  }

  async revokeAccess(id: string): Promise<void> {
    await this.visitorsService.removeVisitor(id);
    this.toastMsg = 'Autorização removida da portaria.';
    setTimeout(() => (this.toastMsg = ''), 3000);
  }

  sharePassWithGuest(v: VisitorAuthorization): void {
    const dateLabel =
      v.accessType === 'permanente'
        ? 'Acesso Permanente Liberado'
        : `Data: ${(v.validDate || '').split('-').reverse().join('/')}`;

    const text = [
      `🏡 *ACESSO LIBERADO — Condomínio Moradas*`,
      ``,
      `Olá, *${v.visitorName}*! Sua entrada já está autorizada no sistema da portaria:`,
      `• *Destino:* Casa ${v.houseNumber} (${this.currentUser?.street || 'Condomínio Moradas'})`,
      `• *Validade:* ${dateLabel}`,
      v.vehiclePlate ? `• *Veículo:* ${v.vehiclePlate}` : null,
      ``,
      `_Ao chegar na portaria, basta informar seu nome e o número da Casa ${v.houseNumber}._`
    ]
      .filter(Boolean)
      .join('\n');

    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }
}