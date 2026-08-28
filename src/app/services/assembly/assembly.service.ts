import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { getFirestore, collection, query, where, doc, onSnapshot } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { Ata, VoteChoice } from '../../shared/ata.model';

@Injectable({
  providedIn: 'root'
})
export class AtasService {
  private app = inject(FirebaseApp);
  private db = getFirestore(this.app);

  getActiveAta(): Observable<Ata | null> {
    return new Observable((observer) => {
      const atasRef = collection(this.db, 'assemblies');
      const q = query(atasRef, where('status', '==', 'open'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data() as Ata;
          data.id = docSnap.id;
          observer.next(data);
        } else {
          observer.next(null);
        }
      }, (error) => observer.error(error));

      return () => unsubscribe();
    });
  }

  getPastAtas(): Observable<Ata[]> {
    return new Observable((observer) => {
      const atasRef = collection(this.db, 'assemblies');
      // Buscamos todas e filtramos no cliente para evitar exigência de índice composto no Firestore
      const unsubscribe = onSnapshot(atasRef, (snapshot) => {
        const atas = snapshot.docs
          .map(docSnap => {
            const data = docSnap.data() as Ata;
            data.id = docSnap.id;
            return data;
          })
          .filter(ata => ata.status !== 'open'); // Pega tudo que não for 'open'

        observer.next(atas);
      }, (error) => observer.error(error));

      return () => unsubscribe();
    });
  }

  getAtaById(id: string): Observable<Ata | null> {
    return new Observable((observer) => {
      const docRef = doc(this.db, `assemblies/${id}`);
      
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Ata;
          data.id = docSnap.id;
          observer.next(data);
        } else {
          observer.next(null);
        }
      }, (error) => observer.error(error));

      return () => unsubscribe();
    });
  }

  submitVote(ataId: string, choice: VoteChoice): Observable<boolean> {
    return of(true);
  }
}