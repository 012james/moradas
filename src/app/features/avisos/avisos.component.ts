import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseApp } from '@angular/fire/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { NotificationService } from '../../services/notification/notification.service';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';


export interface CondoNotice {
  id: string;
  title: string;
  category: string;
  body: string;
  authorName: string;
  createdAt: number;
}

export interface CondoContacts {
  portariaPhone: string;
  portariaWhatsapp: string;
  secretariaPhone: string;
  secretariaWhatsapp: string;
  officeHours: string;
}

@Component({
  selector: 'app-avisos',
  standalone: true,
  imports: [CommonModule, FormsModule, HasRoleDirective],
  templateUrl: './avisos.component.html',
  styleUrls: ['./avisos.component.scss']
})
export class AvisosComponent implements OnInit, OnDestroy {
  private db = getFirestore(inject(FirebaseApp));
  private ngZone = inject(NgZone);
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  private noticesUnsub?: () => void;
  private contactsUnsub?: () => void;
  private rulesUnsub?: () => void;

  activeTab: 'avisos' | 'contatos' | 'regras' = 'avisos';

  notices: CondoNotice[] = [];
  contacts: CondoContacts = {
    portariaPhone: '',
    portariaWhatsapp: '',
    secretariaPhone: '',
    secretariaWhatsapp: '',
    officeHours: 'Segunda a Sexta, das 08h00 às 17h00'
  };

  rules: string[] = [
    'Velocidade máxima permitida nas vias internas do condomínio: 20 km/h.',
    'Lei do Silêncio: das 22h00 às 07h00 (domingos e feriados até as 09h00).',
    'Obras e reformas permitidas apenas de segunda a sexta (08h às 17h) e sábados (08h às 12h).',
    'Animais de estimação devem circular nas áreas comuns sempre na guia e acompanhados.',
    'Visitantes e prestadores devem ser liberados previamente pelo aplicativo na aba Visitas.'
  ];

  // Formulário Novo Aviso
  showNoticeForm = false;
  noticeTitle = '';
  noticeCategory = 'Comunicado Geral';
  noticeBody = '';
  sendEmailOnPublish = true;

  // Edição Contatos / Regras
  editingContacts = false;
  contactForm: CondoContacts = { ...this.contacts };

  editingRules = false;
  editableRulesText = '';

  isSubmitting = false;
  toastMsg = '';

  ngOnInit(): void {
    this.noticesUnsub = onSnapshot(collection(this.db, 'notices'), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as CondoNotice))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      this.ngZone.run(() => (this.notices = list));
    });

    this.contactsUnsub = onSnapshot(doc(this.db, 'condo_settings', 'contacts'), (snap) => {
      if (snap.exists()) {
        this.ngZone.run(() => {
          this.contacts = { ...this.contacts, ...(snap.data() as CondoContacts) };
        });
      }
    });

    this.rulesUnsub = onSnapshot(doc(this.db, 'condo_settings', 'rules'), (snap) => {
      if (snap.exists() && Array.isArray(snap.data()['items'])) {
        this.ngZone.run(() => (this.rules = snap.data()['items']));
      }
    });
  }

  ngOnDestroy(): void {
    this.noticesUnsub?.();
    this.contactsUnsub?.();
    this.rulesUnsub?.();
  }

  async publishNotice(): Promise<void> {
    if (!this.noticeTitle.trim() || !this.noticeBody.trim()) return;
    this.isSubmitting = true;

    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      await addDoc(collection(this.db, 'notices'), {
        title: this.noticeTitle.trim(),
        category: this.noticeCategory,
        body: this.noticeBody.trim(),
        authorName: user?.name || 'Administração',
        createdAt: Date.now()
      });

      this.noticeTitle = '';
      this.noticeBody = '';
      this.showNoticeForm = false;
      this.showToast('Comunicado publicado no mural!');
    } finally {
      this.isSubmitting = false;
    }
  }

  async deleteNotice(id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'notices', id));
    this.showToast('Aviso removido.');
  }

  shareNoticeWhatsApp(notice: CondoNotice): void {
    const text = `📢 *${notice.category.toUpperCase()} — Condomínio Moradas*\n\n*${notice.title}*\n${notice.body}`;
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  startEditContacts(): void {
    this.contactForm = { ...this.contacts };
    this.editingContacts = true;
  }

  async saveContacts(): Promise<void> {
    this.isSubmitting = true;
    try {
      await setDoc(doc(this.db, 'condo_settings', 'contacts'), this.contactForm);
      this.editingContacts = false;
      this.showToast('Contatos atualizados com sucesso!');
    } finally {
      this.isSubmitting = false;
    }
  }

  startEditRules(): void {
    this.editableRulesText = this.rules.join('\n');
    this.editingRules = true;
  }

  async saveRules(): Promise<void> {
    this.isSubmitting = true;
    try {
      const items = this.editableRulesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      await setDoc(doc(this.db, 'condo_settings', 'rules'), { items });
      this.editingRules = false;
      this.showToast('Regras atualizadas com sucesso!');
    } finally {
      this.isSubmitting = false;
    }
  }

  private showToast(msg: string): void {
    this.toastMsg = msg;
    setTimeout(() => (this.toastMsg = ''), 3500);
  }
}