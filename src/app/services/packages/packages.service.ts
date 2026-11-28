import { Injectable, inject, NgZone } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { UserProfile } from '../../shared/models/user.model';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CarrierType, PackageItem } from '../../shared/models/package.model';

@Injectable({
  providedIn: 'root'
})
export class PackagesService {
  private app = inject(FirebaseApp);
  private ngZone = inject(NgZone);
  private db = getFirestore(this.app);

  private generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async registerPackage(
    data: {
      houseNumber: number;
      recipientName: string;
      carrier: CarrierType;
      storageLocation?: string;
    },
    operator: UserProfile
  ): Promise<PackageItem> {
    const packagesRef = collection(this.db, 'packages');
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 365); // Expira em 1 ano

    const newPkg: Omit<PackageItem, 'id'> = {
      houseNumber: Number(data.houseNumber),
      recipientName: data.recipientName.trim(),
      carrier: data.carrier,
      storageLocation: data.storageLocation?.trim() || '',
      pickupPin: this.generatePin(),
      status: 'aguardando',
      receivedAt: Date.now(),
      receivedById: operator.id,
      receivedByName: operator.name,
      expireAt: Timestamp.fromDate(expirationDate) // <-- Campo lido pelo TTL
    };

    const docRef = await addDoc(packagesRef, {
      ...newPkg,
      expireAt: Timestamp.fromDate(oneYearFromNow)
    });

    return {
      id: docRef.id,
      ...newPkg
    };
  }

  // Lista em tempo real para a Portaria (apenas pendentes)
  getPendingPackages$(): Observable<PackageItem[]> {
    return new Observable<PackageItem[]>((observer) => {
      const packagesRef = collection(this.db, 'packages');
      const q = query(packagesRef, where('status', '==', 'aguardando'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs
            .map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data()
            } as unknown as PackageItem))
            .sort((a, b) => b.receivedAt - a.receivedAt);

          this.ngZone.run(() => observer.next(items));
        },
        (error) => this.ngZone.run(() => observer.error(error))
      );

      return () => unsubscribe();
    });
  }

  // Lista em tempo real para o Morador (30 mais recentes da casa)
  getPackagesByHouse$(houseNumber: number): Observable<PackageItem[]> {
    return new Observable<PackageItem[]>((observer) => {
      const packagesRef = collection(this.db, 'packages');
      const q = query(
        packagesRef,
        where('houseNumber', '==', Number(houseNumber)),
        orderBy('receivedAt', 'desc'),
        limit(30)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
          } as unknown as PackageItem));

          this.ngZone.run(() => observer.next(items));
        },
        (error) => this.ngZone.run(() => observer.error(error))
      );

      return () => unsubscribe();
    });
  }

  async confirmPickupWithPin(
    pkg: PackageItem,
    enteredPin: string,
    pickedUpByName: string,
    operator: UserProfile
  ): Promise<boolean> {
    if (pkg.pickupPin !== enteredPin.trim()) {
      return false;
    }

    const pkgRef = doc(this.db, 'packages', pkg.id);
    await updateDoc(pkgRef, {
      status: 'entregue',
      pickedUpAt: Date.now(),
      pickedUpByName: pickedUpByName.trim(),
      releasedById: operator['id'],
      releasedByName: operator['name'],
      validationMethod: 'pin'
    });
    return true;
  }

  async confirmPickupManual(
    pkgId: string,
    pickedUpByName: string,
    pickedUpByDoc: string,
    operator: UserProfile
  ): Promise<void> {
    const pkgRef = doc(this.db, 'packages', pkgId);
    await updateDoc(pkgRef, {
      status: 'entregue',
      pickedUpAt: Date.now(),
      pickedUpByName: pickedUpByName.trim(),
      pickedUpByDoc: pickedUpByDoc.trim(),
      releasedById: operator['id'],
      releasedByName: operator['name'],
      validationMethod: 'manual'
    });
  }

  // 1. Apenas encomendas aguardando retirada (tempo real, sem limite)
getPendingPackagesByHouse$(houseNumber: number | string): Observable<PackageItem[]> {
  return new Observable((observer) => {
    const houseNum = Number(houseNumber);
    const q = query(
      collection(this.db, 'packages'),
      where('houseNumber', '==', houseNum),
      where('status', '==', 'aguardando')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PackageItem[];
        list.sort((a: any, b: any) => (b.receivedAt || 0) - (a.receivedAt || 0));
        this.ngZone.run(() => observer.next(list));
      },
      (err) => {
        console.error('Erro ao buscar encomendas pendentes:', err);
        this.ngZone.run(() => observer.next([]));
      }
    );

    return () => unsub();
  });
}

getDeliveredPackagesByHouse$(
  houseNumber: number | string,
  maxLimit = 15
): Observable<PackageItem[]> {
  return new Observable((observer) => {
    const houseNum = Number(houseNumber);
    const q = query(
      collection(this.db, 'packages'),
      where('houseNumber', '==', houseNum),
      where('status', '==', 'entregue'),
      orderBy('pickedUpAt', 'desc'),
      limit(maxLimit)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as PackageItem[];
        this.ngZone.run(() => observer.next(list));
      },
      (err) => {
        console.error('Erro ao buscar histórico de encomendas (verifique o índice no link acima):', err);
        this.ngZone.run(() => observer.next([]));
      }
    );

    return () => unsub();
  });
}

getDeliveredHistory$(
  startMs?: number,
  endMs?: number,
  maxLimit = 100
): Observable<PackageItem[]> {
  return new Observable<PackageItem[]>((observer) => {
    const constraints: any[] = [where('status', '==', 'entregue')];

    if (startMs !== undefined) {
      constraints.push(where('pickedUpAt', '>=', startMs));
    }
    if (endMs !== undefined) {
      constraints.push(where('pickedUpAt', '<=', endMs));
    }

    constraints.push(orderBy('pickedUpAt', 'desc'), limit(maxLimit));

    const q = query(collection(this.db, 'packages'), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as PackageItem[];
        observer.next(list);
      },
      (err) => {
        console.error('Erro ao buscar histórico de encomendas:', err);
        observer.error(err);
      }
    );

    return () => unsub();
  });
}
}