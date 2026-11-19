import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  Firestore,
  collection,
  addDoc,
  Timestamp
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { NotificationService } from '../../services/notification/notification.service';

@Component({
  selector: 'app-ata-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ata-create.component.html',
  styleUrls: ['./ata-create.component.scss']
})
export class AtaCreateComponent {
  private db = inject(Firestore);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  title = '';
  subtitle = '';
  description = '';
  closingDate = '';
  closingTime = '22:00';
  minimumQuorum = 150;
  locationPreset: 'Virtual (App)' | 'Salão de Festas (Híbrida)' | 'Outro' = 'Virtual (App)';
  customLocation = '';
  pdfUrl = '';

  sendEmailOnPublish = true;
  openWhatsAppOnPublish = false;

  isSubmitting = false;
  errorMessage = '';

  readonly minDate = new Date().toISOString().split('T')[0];

  selectLocationPreset(preset: 'Virtual (App)' | 'Salão de Festas (Híbrida)' | 'Outro'): void {
    this.locationPreset = preset;
  }

  async onCreateAssembly(): Promise<void> {
    this.errorMessage = '';

    if (!this.title.trim() || !this.description.trim() || !this.closingDate) {
      this.errorMessage = 'Preencha o título, a descrição da pauta e a data de encerramento.';
      return;
    }

    const expirationDate = new Date(`${this.closingDate}T${this.closingTime || '23:59'}:00`);
    if (isNaN(expirationDate.getTime()) || expirationDate.getTime() <= Date.now()) {
      this.errorMessage = 'A data e horário de encerramento precisam ser futuros.';
      return;
    }

    this.isSubmitting = true;
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) {
        this.errorMessage = 'Sessão expirada. Faça login novamente.';
        return;
      }

      const finalLocation =
        this.locationPreset === 'Outro'
          ? this.customLocation.trim() || 'Presencial no Condomínio'
          : this.locationPreset;

      const docRef = await addDoc(collection(this.db, 'assemblies'), {
        title: this.title.trim(),
        subtitle: this.subtitle.trim() || 'Assembleia Geral Extraordinária',
        description: this.description.trim(),
        location: finalLocation,
        minimumQuorum: Number(this.minimumQuorum) || 0,
        pdfUrl: this.pdfUrl.trim(),
        status: 'open',
        date: expirationDate.toISOString(),
        expiresAt: Timestamp.fromDate(expirationDate),
        votesCount: 0,
        favorCount: 0,
        contraCount: 0,
        absterCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        abstainCount: 0,
        createdAt: Date.now(),
        createdByUid: user.id || user.uid,
        createdByName: user.name || user.nome || user.displayName || 'Síndico'
      });

      const sharePayload = {
        id: docRef.id,
        title: this.title.trim(),
        subtitle: this.subtitle.trim() || 'Assembleia Geral Extraordinária',
        description: this.description.trim(),
        date: expirationDate.toISOString(),
        location: finalLocation,
        votesCount: 0
      };

      if (this.sendEmailOnPublish) {
        try {
          await this.notificationService.sendAssemblyEmailToResidents(sharePayload, false);
        } catch (emailErr) {
          console.warn('Assembleia publicada, mas falha ao enfileirar e-mails:', emailErr);
        }
      }

      if (this.openWhatsAppOnPublish) {
        this.notificationService.shareAssemblyOnWhatsApp(sharePayload);
      }

      await this.router.navigate(['/atas']);
    } catch (err) {
      console.error('Erro ao publicar assembleia:', err);
      this.errorMessage = 'Não foi possível publicar a assembleia. Verifique sua conexão e permissões.';
    } finally {
      this.isSubmitting = false;
    }
  }
}