import { Injectable, inject, NgZone } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  Timestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Ata } from '../../shared/models/ata.model';
import { VoteChoice } from '../AssemblyVoting/AssemblyVoting.service';


export interface VoteResultsSummary {
  approved: number;
  rejected: number;
  abstain: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class AssemblyService {
  private app = inject(FirebaseApp);
  private db = getFirestore(this.app);
  private auth = getAuth(this.app);
  private ngZone = inject(NgZone);

  // 1. Lista todas as assembleias em tempo real (usado na tela AtasListComponent)
  getAssemblies$(): Observable<Ata[]> {

    return new Observable((observer) => {
      const colRef = collection(this.db, 'assemblies');

      const unsub = onSnapshot(
        colRef,
        (snapshot) => {
          const items = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as any;
            const rawExpires = data.expiresAt?.toDate
              ? data.expiresAt.toDate()
              : data.expiresAt
                ? new Date(data.expiresAt)
                : data.date
                  ? new Date(data.date)
                  : null;

            return {
              id: docSnap.id,
              ...data,
              expiresAt: rawExpires,
              date: data.date || (rawExpires ? rawExpires.toISOString() : null)
            } as Ata;
          });

          items.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          observer.next(items);
        },
        (err) => observer.error(err)
      );

      return () => unsub();
    });

  }

  // 2. Carrega os detalhes da pauta e identifica se a casa do usuário já votou
  getAtaById(ataId: string): Observable<Ata | null> {
    return new Observable<Ata | null>((observer) => {
      const ataRef = doc(this.db, 'assemblies', ataId);

      const unsub = onSnapshot(
        ataRef,
        async (docSnap) => {
          if (!docSnap.exists()) {
            this.ngZone.run(() => observer.next(null));
            return;
          }

          const data = docSnap.data();
          let userVote: VoteChoice | null = null;

          // Verifica o voto registrado pela unidade (casa) do usuário logado
          const currentUid = this.auth.currentUser?.uid;
          if (currentUid) {
            try {
              const userSnap = await getDoc(doc(this.db, 'users', currentUid));
              const houseNumber = userSnap.data()?.['houseNumber'];
              if (houseNumber) {
                const voteSnap = await getDoc(
                  doc(this.db, 'assemblies', ataId, 'votes', String(houseNumber))
                );
                if (voteSnap.exists()) {
                  userVote = (voteSnap.data()['choice'] as VoteChoice) ?? null;
                }
              }
            } catch {
              // Mantém userVote como null caso o usuário ainda não tenha casa vinculada
            }
          }

          const ataItem = {
            id: docSnap.id,
            ...data,
            userVote
          } as unknown as Ata;

          this.ngZone.run(() => observer.next(ataItem));
        },
        (error) => this.ngZone.run(() => observer.error(error))
      );

      return () => unsub();
    });
  }

  // 3. Escuta o placar consolidado da assembleia em tempo real
  getVoteResults(ataId: string): Observable<VoteResultsSummary> {
    return new Observable<VoteResultsSummary>((observer) => {
      const ataRef = doc(this.db, 'assemblies', ataId);

      const unsub = onSnapshot(
        ataRef,
        (docSnap) => {
          const data = docSnap.data() || {};
          const approved = Number(data['approvedCount'] ?? data['favorCount'] ?? 0);
          const rejected = Number(data['rejectedCount'] ?? data['contraCount'] ?? 0);
          const abstain = Number(data['abstainCount'] ?? data['absterCount'] ?? 0);
          const total = Number(data['votesCount'] ?? approved + rejected + abstain);

          this.ngZone.run(() =>
            observer.next({ approved, rejected, abstain, total })
          );
        },
        (error) => this.ngZone.run(() => observer.error(error))
      );

      return () => unsub();
    });
  }

  // 4. Registra ou altera o voto da unidade (1 voto por casa) com transação atômica
  async submitVote(
    ataId: string,
    userId: string,
    option: VoteChoice
  ): Promise<void> {
    const userRef = doc(this.db, 'users', userId);
    const ataRef = doc(this.db, 'assemblies', ataId);

    await runTransaction(this.db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('Perfil do morador não encontrado.');
      }

      const userData = userSnap.data();
      const houseNumber = Number(userData['houseNumber']);
      if (userData['status'] !== 'approved' || !houseNumber) {
        throw new Error('Apenas moradores aprovados podem votar.');
      }

      const ataSnap = await transaction.get(ataRef);
      if (!ataSnap.exists()) {
        throw new Error('Assembleia não encontrada.');
      }

      const ataData = ataSnap.data();
      const rawExpires = ataData['expiresAt'];
      const expiresMs =
        typeof rawExpires?.toDate === 'function'
          ? rawExpires.toDate().getTime()
          : rawExpires
          ? new Date(rawExpires).getTime()
          : Date.now() + 86400000;

      if (ataData['status'] === 'closed' || expiresMs <= Date.now()) {
        throw new Error('O prazo desta votação já foi encerrado.');
      }

      const voteRef = doc(this.db, 'assemblies', ataId, 'votes', String(houseNumber));
      const existingVoteSnap = await transaction.get(voteRef);

      let approved = Number(ataData['approvedCount'] ?? ataData['favorCount'] ?? 0);
      let rejected = Number(ataData['rejectedCount'] ?? ataData['contraCount'] ?? 0);
      let abstain = Number(ataData['abstainCount'] ?? ataData['absterCount'] ?? 0);
      let total = Number(ataData['votesCount'] ?? approved + rejected + abstain);

      const normalizedNew = this.normalizeChoice(option);

      if (existingVoteSnap.exists()) {
        const previousRaw = existingVoteSnap.data()['choice'] as string;
        const normalizedPrev = this.normalizeChoice(previousRaw);

        if (normalizedPrev === normalizedNew) {
          return;
        }

        if (normalizedPrev === 'approved') approved = Math.max(0, approved - 1);
        if (normalizedPrev === 'rejected') rejected = Math.max(0, rejected - 1);
        if (normalizedPrev === 'abstain') abstain = Math.max(0, abstain - 1);
      } else {
        total += 1;
      }

      if (normalizedNew === 'approved') approved += 1;
      if (normalizedNew === 'rejected') rejected += 1;
      if (normalizedNew === 'abstain') abstain += 1;

      transaction.set(voteRef, {
        houseNumber,
        choice: option,
        voterUid: userId,
        voterName: userData['name'] || userData['nome'] || `Casa ${houseNumber}`,
        votedAt: Date.now()
      });

      transaction.update(ataRef, {
        votesCount: total,
        approvedCount: approved,
        rejectedCount: rejected,
        abstainCount: abstain,
        favorCount: approved,
        contraCount: rejected,
        absterCount: abstain
      });
    });
  }

  // 5. Métodos auxiliares do Síndico (Criar, Encerrar e Excluir)
  async createAssembly(payload: Record<string, any>): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'assemblies'), {
      ...payload,
      status: 'open',
      votesCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      abstainCount: 0,
      createdAt: Date.now(),
      expiresAt:
        payload['expiresAt'] instanceof Date
          ? Timestamp.fromDate(payload['expiresAt'])
          : payload['expiresAt']
    });
    return docRef.id;
  }

  async closeAssembly(ataId: string): Promise<void> {
    await updateDoc(doc(this.db, 'assemblies', ataId), { status: 'closed' });
  }

  async deleteAssembly(ataId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'assemblies', ataId));
  }

  private normalizeChoice(choice: string): 'approved' | 'rejected' | 'abstain' {
    if (choice === 'approved' || choice === 'favor') return 'approved';
    if (choice === 'rejected' || choice === 'contra') return 'rejected';
    return 'abstain';
  }

  async closeExpiredAta(ataId: string): Promise<void> {
    try {
      const ataRef = doc(this.db, `SUA_COLECAO_AQUI/${ataId}`);
      await updateDoc(ataRef, { status: 'closed' });
    } catch {
      // Ignora silenciosamente se já foi fechado por outro usuário
    }
  }
}