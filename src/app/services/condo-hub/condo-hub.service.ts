import { Injectable, inject, NgZone } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { UserProfile } from '../../shared/models/user.model';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CondoGeneralSettings, NoticeItem, NoticePriority } from '../../shared/models/condo-hub.model';


@Injectable({
  providedIn: 'root'
})
export class CondoHubService {
  private db = getFirestore(inject(FirebaseApp));
  private ngZone = inject(NgZone);

  private readonly defaultSettings: CondoGeneralSettings = {
    regimentoPdfUrl: '',
    contacts: [
      {
        id: 'portaria',
        roleTitle: 'Portaria 24h',
        schedule: 'Funcionamento ininterrupto (24 horas)',
        phone: '(34) 3820-0001',
        whatsapp: '5534999990001',
        notes: 'Liberação de visitantes, entregas e emergências internas.'
      },
      {
        id: 'secretaria',
        roleTitle: 'Secretaria / Administração',
        schedule: 'Seg a Sex das 08h às 17h • Sáb das 08h às 12h',
        phone: '(34) 3820-0002',
        whatsapp: '5534999990002',
        notes: 'Segunda via de boletos, reservas do salão, cadastros e dúvidas.'
      },
      {
        id: 'zeladoria',
        roleTitle: 'Zeladoria e Manutenção',
        schedule: 'Seg a Sex das 08h às 17h',
        phone: '(34) 3820-0003',
        whatsapp: '',
        notes: 'Apoio técnico em áreas comuns, jardinagem e iluminação.'
      }
    ],
    rules: [
      {
        id: 'silencio',
        icon: 'volume_off',
        title: 'Horário de Silêncio (22h às 08h)',
        summary: 'Proibido som alto, festas ruidosas ou equipamentos barulhentos após as 22h em todas as 600 unidades.'
      },
      {
        id: 'obras',
        icon: 'construction',
        title: 'Obras e Reformas (Seg a Sex • 08h às 17h)',
        summary: 'Sábados permitido apenas das 08h às 12h sem ruído estrutural. Proibido aos domingos e feriados.'
      },
      {
        id: 'velocidade',
        icon: 'speed',
        title: 'Limite de Velocidade: 20 km/h',
        summary: 'Respeite a sinalização nas alamedas e dê preferência absoluta a pedestres e crianças.'
      },
      {
        id: 'lixo',
        icon: 'delete_sweep',
        title: 'Coleta de Lixo e Descarte',
        summary: 'Disponibilize o lixo devidamente ensacado apenas nos dias e horários oficiais de coleta.'
      },
      {
        id: 'pets',
        icon: 'pets',
        title: 'Passeio com Animais Domésticos',
        summary: 'Obrigatório o uso de guia nas vias comuns e recolhimento imediato dos dejetos pelo tutor.'
      }
    ]
  };

  // Escuta comunicados ordenando fixados primeiro e depois os mais recentes
  getNotices$(): Observable<NoticeItem[]> {
    return new Observable<NoticeItem[]>((observer) => {
      const ref = collection(this.db, 'notices');
      const unsub = onSnapshot(
        ref,
        (snap) => {
          const items = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as unknown as NoticeItem))
            .sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              return b.createdAt - a.createdAt;
            });
          this.ngZone.run(() => observer.next(items));
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  // Escuta Contatos e Regras em tempo real
  getCondoSettings$(): Observable<CondoGeneralSettings> {
    return new Observable<CondoGeneralSettings>((observer) => {
      const ref = doc(this.db, 'condo_settings', 'general');
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as CondoGeneralSettings;
            this.ngZone.run(() =>
              observer.next({
                regimentoPdfUrl: data.regimentoPdfUrl || '',
                contacts: data.contacts?.length ? data.contacts : this.defaultSettings.contacts,
                rules: data.rules?.length ? data.rules : this.defaultSettings.rules
              })
            );
          } else {
            this.ngZone.run(() => observer.next(this.defaultSettings));
          }
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  async createNotice(
    payload: { title: string; content: string; priority: NoticePriority; pinned: boolean },
    sindico: UserProfile
  ): Promise<void> {
    await addDoc(collection(this.db, 'notices'), {
      title: payload.title.trim(),
      content: payload.content.trim(),
      priority: payload.priority,
      pinned: payload.pinned,
      createdAt: Date.now(),
      authorName: sindico['name']
    });
  }

  async deleteNotice(noticeId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'notices', noticeId));
  }

  async saveCondoSettings(settings: CondoGeneralSettings, sindico: UserProfile): Promise<void> {
    const ref = doc(this.db, 'condo_settings', 'general');
    await setDoc(ref, {
      ...settings,
      updatedAt: Date.now(),
      updatedBy: sindico['name']
    });
  }
}