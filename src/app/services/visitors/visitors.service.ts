import { Injectable, inject, NgZone } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  limit,
  orderBy,
  increment,
  Timestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { VisitorCategory, VisitorAccessType, VisitorAuthorization, VisitorLog } from '../../shared/models/visitor.model';
import { UserProfile } from '../../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class VisitorsService {
  private db = getFirestore(inject(FirebaseApp));
  private ngZone = inject(NgZone);

  async authorizeVisitor(
    data: {
      visitorName: string;
      visitorDoc?: string;
      vehiclePlate?: string;
      category: VisitorCategory;
      accessType: VisitorAccessType;
      validDate?: string;
      notes?: string;
    },
    resident: UserProfile
  ): Promise<VisitorAuthorization> {
    const today = new Date().toISOString().split('T')[0];
    const cleanPlate = (data.vehiclePlate || '').trim().toUpperCase();

    const payload: Omit<VisitorAuthorization, 'id'> = {
      houseNumber: Number(resident.houseNumber),
      visitorName: data.visitorName.trim(),
      visitorDoc: data.visitorDoc?.trim() || '',
      vehiclePlate: cleanPlate,
      category: data.category,
      accessType: data.accessType,
      validDate: data.accessType === 'unico' ? data.validDate || today : '',
      notes: data.notes?.trim() || '',
      active: true,
      authorizedByUid: resident.id,
      authorizedByName: resident.name,
      createdAt: Date.now(),
      entryCount: 0
    };

    const docRef = await addDoc(collection(this.db, 'visitors'), payload);
    return { id: docRef.id, ...payload };
  }

  // Visão do Morador: liberações do dia + lista permanente da própria casa
  getVisitorsByHouse$(houseNumber: number): Observable<VisitorAuthorization[]> {
    return new Observable<VisitorAuthorization[]>((observer) => {
      const q = query(
        collection(this.db, 'visitors'),
        where('houseNumber', '==', Number(houseNumber))
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as unknown as VisitorAuthorization))
            .sort((a, b) => b.createdAt - a.createdAt);
          this.ngZone.run(() => observer.next(list));
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  // Visão da Portaria: todos os visitantes ativos do condomínio em tempo real
  getActiveVisitorsForGatehouse$(): Observable<VisitorAuthorization[]> {
    return new Observable<VisitorAuthorization[]>((observer) => {
      const q = query(collection(this.db, 'visitors'), where('active', '==', true));

      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as unknown as VisitorAuthorization))
            .sort((a, b) => a.houseNumber - b.houseNumber);
          this.ngZone.run(() => observer.next(list));
        },
        (err) => this.ngZone.run(() => observer.error(err))
      );
      return () => unsub();
    });
  }

  // Porteiro confirma a entrada na guarita:
  // - Se for 'unico', já encerra o passe (active: false) após entrar para evitar reuso indevido em outro dia
  // - Se for 'permanente', mantém ativo e atualiza o carimbo de última entrada
  async registerGateEntry(
    visitor: VisitorAuthorization,
    operator: { uid?: string; id?: string; name?: string }
  ): Promise<void> {
    const now = Date.now();
    const operatorName = operator.name || 'Portaria';
    const visitorRef = doc(this.db, `visitors/${visitor.id}`);

    try {
      await updateDoc(visitorRef, {
        active: visitor.accessType === 'permanente',
        entryCount: increment(1),
        lastEntryAt: now,
        lastCheckedInBy: operatorName
      });

      // Dentro do addDoc de visitor_logs:
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 365); // Expira em 1 ano

      await addDoc(collection(this.db, 'visitor_logs'), {
        visitorId: visitor.id,
        houseNumber: Number(visitor.houseNumber),
        visitorName: visitor.visitorName || visitor.category || 'Visitante',
        category: visitor.category || 'Visitante',
        accessType: visitor.accessType,
        vehiclePlate: visitor.vehiclePlate || '',
        visitorDoc: visitor.visitorDoc || '',
        authorizedByName: visitor.authorizedByName || 'Morador',
        checkedInByUid: operator.uid || operator.id || '',
        checkedInByName: operatorName,
        enteredAt: now,
        expireAt: Timestamp.fromDate(expirationDate) // <-- Campo lido pelo TTL
      });
    } catch (err: any) {
      console.error('FALHA AO GRAVAR LOG:', err);
      alert('Erro ao salvar histórico: ' + (err?.message || err));
      throw err;
    }
  }

  async togglePermanentActive(visitorId: string, active: boolean): Promise<void> {
    await updateDoc(doc(this.db, 'visitors', visitorId), { active });
  }

  async removeVisitor(visitorId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'visitors', visitorId));
  }

  getGatehouseVisitors$(): Observable<VisitorAuthorization[]> {
  return new Observable((observer) => {
    const colRef = collection(this.db, 'visitors');

    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as VisitorAuthorization[];

        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        observer.next(list);
      },
      (err) => {
        console.error('Erro ao ouvir visitantes na portaria:', err);
        observer.next([]);
      }
    );

    return () => unsub();
  });
}

getVisitorLogs$(maxItems = 300): Observable<VisitorLog[]> {
    return new Observable((observer) => {
      const q = query(
        collection(this.db, 'visitor_logs'),
        orderBy('enteredAt', 'desc'),
        limit(maxItems)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const logs = snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          })) as VisitorLog[];

          observer.next(logs);
        },
        (err) => {
          console.error('Erro ao carregar histórico de acessos:', err);
          observer.next([]);
        }
      );

      return () => unsub();
    });
  }
}