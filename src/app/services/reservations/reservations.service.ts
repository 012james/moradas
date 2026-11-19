import { Injectable, inject, NgZone } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { UserProfile } from '../../shared/models/user.model';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CondoSpaceConfig, ReservationItem } from '../../shared/models/reservation.model';


@Injectable({
  providedIn: 'root'
})
export class ReservationsService {
  private db = getFirestore(inject(FirebaseApp));
  private ngZone = inject(NgZone);

  readonly defaultSpaces: CondoSpaceConfig[] = [
    {
      id: 'salao_festas',
      name: 'Salão de Festas',
      icon: 'celebration',
      fee: 150,
      capacity: 80,
      hours: '09h00 às 22h00',
      cancellationHours: 48,
      rules: [
        'Taxa de R$ 150,00 lançada automaticamente no próximo boleto condominial da unidade.',
        'Respeito rigoroso à Lei do Silêncio após as 22h00 (som ambiente reduzido).',
        'A lista nominal de convidados externos deve ser entregue na Portaria até 24h antes.',
        'Retirada e devolução das chaves na Portaria mediante vistoria de móveis e estrutura.',
        'Cancelamento sem cobrança permitido apenas com no mínimo 48h de antecedência.'
      ]
    },
    {
      id: 'quiosque_1',
      name: 'Quiosque 1 (Churrasco)',
      icon: 'outdoor_grill',
      fee: 50,
      capacity: 25,
      hours: '09h00 às 22h00',
      cancellationHours: 24,
      rules: [
        'Taxa de utilização e limpeza de R$ 50,00 inclusa no próximo boleto da casa.',
        'Capacidade máxima de 25 pessoas (entre moradores e visitantes da unidade).',
        'Proibido som automotivo ou caixas amplificadas de alta potência.',
        'Entregar a churrasqueira sem brasas acesas e descartar o lixo nas lixeiras externas.',
        'Cancelamento isento de taxa até 24h antes da data agendada.'
      ]
    },
    {
      id: 'quiosque_2',
      name: 'Quiosque 2 (Churrasco)',
      icon: 'outdoor_grill',
      fee: 50,
      capacity: 25,
      hours: '09h00 às 22h00',
      cancellationHours: 24,
      rules: [
        'Taxa de utilização e limpeza de R$ 50,00 inclusa no próximo boleto da casa.',
        'Capacidade máxima de 25 pessoas (entre moradores e visitantes da unidade).',
        'Proibido som automotivo ou caixas amplificadas de alta potência.',
        'Entregar a churrasqueira sem brasas acesas e descartar o lixo nas lixeiras externas.',
        'Cancelamento isento de taxa até 24h antes da data agendada.'
      ]
    }
  ];

  // Escuta configurações, valores e regras editáveis pelo Síndico
  getSpacesConfig$(): Observable<CondoSpaceConfig[]> {
    return new Observable<CondoSpaceConfig[]>((observer) => {
      const ref = doc(this.db, 'condo_settings', 'spaces');
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (snap.exists() && Array.isArray(snap.data()['spaces'])) {
            this.ngZone.run(() => observer.next(snap.data()['spaces'] as CondoSpaceConfig[]));
          } else {
            this.ngZone.run(() => observer.next(this.defaultSpaces));
          }
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  // Salva alterações de valores/regras feitas pelo Síndico no próprio app
  async saveSpacesConfig(spaces: CondoSpaceConfig[], sindico: UserProfile): Promise<void> {
    const ref = doc(this.db, 'condo_settings', 'spaces');
    await setDoc(ref, {
      spaces,
      updatedAt: Date.now(),
      updatedBy: sindico.name
    });
  }

  // Escuta todas as reservas ativas para pintar datas ocupadas no calendário
  getAllReservations$(): Observable<ReservationItem[]> {
    return new Observable<ReservationItem[]>((observer) => {
      const unsub = onSnapshot(
        collection(this.db, 'reservations'),
        (snap) => {
          const today = new Date().toISOString().split('T')[0];
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as unknown as ReservationItem))
            .filter((r) => r.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date));

          this.ngZone.run(() => observer.next(list));
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  // Cria reserva usando `${spaceId}_${date}` como ID para impedir conflito duplo
  async createReservation(
    space: CondoSpaceConfig,
    date: string,
    user: UserProfile
  ): Promise<ReservationItem> {
    const docId = `${space.id}_${date}`;
    const docRef = doc(this.db, 'reservations', docId);

    const existing = await getDoc(docRef);
    if (existing.exists()) {
      throw new Error('Esta data acabou de ser reservada por outra unidade.');
    }

    const payload: ReservationItem = {
      id: docId,
      spaceId: space.id,
      spaceName: space.name,
      date,
      feeSnapshot: Number(space.fee),
      houseNumber: Number(user.houseNumber),
      residentUid: user.id,
      residentName: user.name,
      residentPhone: user.phone || '',
      acceptedRules: true,
      createdAt: Date.now()
    };

    await setDoc(docRef, payload);
    return payload;
  }

  async cancelReservation(reservationId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'reservations', reservationId));
  }
}