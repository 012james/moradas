import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { UserProfile } from '../../shared/models/user.model';
import { AuthService } from '../../services/auth/auth.service';
import { NotificationService } from '../../services/notification/notification.service';
import { PackagesService } from '../../services/packages/packages.service';
import { CarrierType, PackageItem } from '../../shared/models/package.model';


@Component({
  selector: 'app-portaria-encomendas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './portaria-encomendas.component.html',
  styleUrls: ['./portaria-encomendas.component.scss']
})
export class PortariaEncomendasComponent implements OnInit, OnDestroy {
  private packagesService = inject(PackagesService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private sub?: Subscription;

  carriers: CarrierType[] = ['Mercado Livre', 'Shopee', 'Amazon', 'Correios', 'Outros'];

  // Campos de Entrada Rápida
  houseNumber: number | null = null;
  houseResidents: UserProfile[] = [];
  recipientName = '';
  selectedCarrier: CarrierType = 'Mercado Livre';
  storageLocation = '';
  openWhatsAppAfterSave = true;

  isSaving = false;
  feedbackMsg = '';
  lastRegisteredPkg: PackageItem | null = null;

  // Lista e Filtro de Retirada
  pendingPackages: PackageItem[] = [];
  searchTerm = '';

  // Estado de Baixa do Pacote Selecionado
  activePackageId: string | null = null;
  manualMode = false;
  enteredPin = '';
  pickedUpByName = '';
  pickedUpByDoc = '';
  pickupError = '';
  isReleasing = false;

  ngOnInit(): void {
    this.sub = this.packagesService.getPendingPackages$().subscribe((list) => {
      this.pendingPackages = list;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get filteredPackages(): PackageItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.pendingPackages;

    return this.pendingPackages.filter(
      (pkg) =>
        pkg.houseNumber.toString().includes(term) ||
        pkg.recipientName.toLowerCase().includes(term)
    );
  }

  // Busca automaticamente os moradores da casa digitada para agilizar o balcão
  async onHouseNumberChange(): Promise<void> {
    if (!this.houseNumber || this.houseNumber < 1 || this.houseNumber > 606) {
      this.houseResidents = [];
      return;
    }

    this.houseResidents = await this.notificationService.getApprovedResidentsByHouse(
      this.houseNumber
    );

    // Se houver apenas 1 morador e o campo destinatário estiver vazio, pré-preenche
    if (this.houseResidents.length === 1 && !this.recipientName.trim()) {
      this.recipientName = this.houseResidents[0]['name'] as unknown as string;
    }
  }

  fillRecipient(name: string): void {
    this.recipientName = name;
  }

  selectCarrier(carrier: CarrierType): void {
    this.selectedCarrier = carrier;
  }

  async onRegisterPackage(): Promise<void> {
    if (
      !this.houseNumber ||
      this.houseNumber < 1 ||
      this.houseNumber > 606 ||
      !this.recipientName.trim()
    ) {
      return;
    }

    this.isSaving = true;
    try {
      const operator = await firstValueFrom(this.authService.currentUser$);
      if (!operator) return;

      const createdPkg = await this.packagesService.registerPackage(
        {
          houseNumber: this.houseNumber,
          recipientName: this.recipientName,
          carrier: this.selectedCarrier,
          storageLocation: this.storageLocation
        },
        operator
      );

      this.lastRegisteredPkg = createdPkg;

      // 1. Dispara o E-mail com o PIN automaticamente para os moradores aprovados da casa
      const emailResult = await this.notificationService.sendPackageArrivalEmail(
        createdPkg,
        false
      );

      // 2. Se o envio rápido de WhatsApp estiver marcado, já abre a janela com o PIN
      if (this.openWhatsAppAfterSave) {
        await this.notificationService.sharePackageOnWhatsApp(createdPkg);
      }

      const emailNotice =
        emailResult.totalRecipients > 0
          ? `E-mail enviado (${emailResult.totalRecipients})`
          : 'Sem e-mail aprovado na casa';

      this.feedbackMsg = `Casa ${createdPkg.houseNumber} registrada (PIN ${createdPkg.pickupPin}) • ${emailNotice}!`;

      this.houseNumber = null;
      this.houseResidents = [];
      this.recipientName = '';
      this.storageLocation = '';
      setTimeout(() => (this.feedbackMsg = ''), 6000);
    } finally {
      this.isSaving = false;
    }
  }

  async notifyPackageViaWhatsApp(pkg: PackageItem): Promise<void> {
    await this.notificationService.sharePackageOnWhatsApp(pkg);
  }

  async notifyPackageViaEmail(pkg: PackageItem): Promise<void> {
    const res = await this.notificationService.sendPackageArrivalEmail(pkg, true);
    this.feedbackMsg =
      res.totalRecipients > 0
        ? `E-mail com PIN enviado para a Casa ${pkg.houseNumber}!`
        : `A Casa ${pkg.houseNumber} ainda não possui morador aprovado com e-mail.`;
    setTimeout(() => (this.feedbackMsg = ''), 4000);
  }

  openPickupPanel(pkg: PackageItem): void {
    if (this.activePackageId === pkg.id) {
      this.cancelPickup();
      return;
    }
    this.activePackageId = pkg.id;
    this.manualMode = false;
    this.enteredPin = '';
    this.pickedUpByName = pkg.recipientName;
    this.pickedUpByDoc = '';
    this.pickupError = '';
  }

  cancelPickup(): void {
    this.activePackageId = null;
    this.pickupError = '';
  }

  async confirmRelease(pkg: PackageItem): Promise<void> {
    this.pickupError = '';
    if (!this.pickedUpByName.trim()) {
      this.pickupError = 'Informe o nome de quem está retirando.';
      return;
    }

    const operator = await firstValueFrom(this.authService.currentUser$);
    if (!operator) return;

    this.isReleasing = true;
    try {
      if (!this.manualMode) {
        const valid = await this.packagesService.confirmPickupWithPin(
          pkg,
          this.enteredPin,
          this.pickedUpByName,
          operator
        );
        if (!valid) {
          this.pickupError = 'PIN incorreto. Confira o código no celular do morador.';
          return;
        }
      } else {
        if (!this.pickedUpByDoc.trim()) {
          this.pickupError = 'O documento (RG/CPF) é obrigatório na baixa sem PIN.';
          return;
        }
        await this.packagesService.confirmPickupManual(
          pkg.id,
          this.pickedUpByName,
          this.pickedUpByDoc,
          operator
        );
      }
      this.cancelPickup();
    } finally {
      this.isReleasing = false;
    }
  }
}