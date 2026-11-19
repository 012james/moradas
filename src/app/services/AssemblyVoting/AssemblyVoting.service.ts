import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
  collection,
  onSnapshot,
} from '@angular/fire/firestore';
import { UserProfile } from '../../shared/models/user.model';
import { Observable } from 'rxjs';
import { Ata } from '../../shared/models/ata.model';


export type VoteChoice = 'favor' | 'contra' | 'abster';

export interface HouseVote {
  houseNumber: number;
  choice: VoteChoice;
  votedByUid: string;
  votedByName: string;
  votedAt: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class AssemblyVotingHelperService {
  private db = getFirestore(inject(FirebaseApp));

  // Grava 1 voto por CASA (ex: assemblies/ata123/votes/402)
  async castHouseVote(ataId: string, choice: VoteChoice, user: UserProfile): Promise<void> {
    if (user.status !== 'approved' || !user.houseNumber) {
      throw new Error('Unidade não habilitada para votação.');
    }

    const houseDocId = String(Number(user.houseNumber));
    const voteRef = doc(this.db, `assemblies/${ataId}/votes/${houseDocId}`);

    await setDoc(voteRef, {
      houseNumber: Number(user.houseNumber),
      choice,
      votedByUid: user.id,
      votedByName: user.name,
      votedAt: serverTimestamp()
    });
  }

  // Calcula encerramento e resultado em memória sem exigir escrita do morador
  evaluateAssemblyStatus(
    ata: { status: 'open' | 'closed'; expiresAt?: Timestamp },
    votes: HouseVote[],
    minimumQuorum = 1
  ): { isClosed: boolean; outcome: 'aprovada' | 'reprovada' | 'empate' | 'sem_quorum' | 'em_aberto' } {
    const expiredByTime = ata.expiresAt ? Date.now() >= ata.expiresAt.toMillis() : false;
    const isClosed = ata.status === 'closed' || expiredByTime;

    if (!isClosed) {
      return { isClosed: false, outcome: 'em_aberto' };
    }

    if (votes.length < minimumQuorum) {
      return { isClosed: true, outcome: 'sem_quorum' };
    }

    const favor = votes.filter((v) => v.choice === 'favor').length;
    const contra = votes.filter((v) => v.choice === 'contra').length;

    if (favor > contra) return { isClosed: true, outcome: 'aprovada' };
    if (contra > favor) return { isClosed: true, outcome: 'reprovada' };
    return { isClosed: true, outcome: 'empate' };
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
}