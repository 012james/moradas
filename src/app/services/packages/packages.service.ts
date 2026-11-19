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
    const newPkg: Omit<PackageItem, 'id'> = {
      houseNumber: Number(data.houseNumber),
      recipientName: data.recipientName.trim(),
      carrier: data.carrier,
      storageLocation: data.storageLocation?.trim() || '',
      pickupPin: this.generatePin(),
      status: 'aguardando',
      receivedAt: Date.now(),
      receivedById: operator.id,
      receivedByName: operator.name
    };

    const docRef = await addDoc(packagesRef, newPkg);
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

  // Lista em tempo real para o Morador (aguardando + histórico da casa)
  getPackagesByHouse$(houseNumber: number): Observable<PackageItem[]> {
    return new Observable<PackageItem[]>((observer) => {
      const packagesRef = collection(this.db, 'packages');
      const q = query(packagesRef, where('houseNumber', '==', Number(houseNumber)));

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
}