import { Injectable, inject } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { getFirestore, collection, query, where, doc, onSnapshot, setDoc, updateDoc, getDocs } from '@angular/fire/firestore';
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
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data() as Ata;
          data.id = docSnap.id;

          // Se a data expirou, muda para 'closed' no banco e limpa a ata ativa
          if (this.isAtaExpired(data.date)) {
            await this.closeAtaAndCalculateOutcome(data.id);
            observer.next(null);
            return;
          }

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

 // Registra ou atualiza o voto do usuário
  async submitVote(ataId: string, userId: string, choice: string, ataDate?: string): Promise<void> {
    // A chave de segurança: o ID do doc é o userId. 
    // Garante a regra 1 voto por morador.
    if (ataDate && this.isAtaExpired(ataDate)) {
      const docRef = doc(this.db, 'assemblies', ataId);
      await updateDoc(docRef, { status: 'closed' });
      throw new Error('Esta votação já foi encerrada.');
    }
    const voteRef = doc(this.db, `assemblies/${ataId}/votes/${userId}`);
    
    await setDoc(voteRef, {
      choice: choice,
      votedAt: new Date().toISOString()
    });
  }

  // Retorna a contagem reativa para montar o gráfico ou resultado
 getVoteResults(ataId: string): Observable<{ approved: number, rejected: number, abstain: number, total: number }> {
    return new Observable((observer) => {
      // 1. Remove espaços invisíveis ou quebras de linha que possam vir da URL
      const cleanAtaId = ataId ? ataId.trim() : '';

      // 2. Referência encadeada (método mais seguro da SDK modular)
      const ataDocRef = doc(this.db, 'assemblies', cleanAtaId);
      const votesRef = collection(ataDocRef, 'votes');

      const unsubscribe = onSnapshot(votesRef, (snapshot) => {

        let approved = 0;
        let rejected = 0;
        let abstain = 0;

        snapshot.forEach(docSnap => {
          const voteData = docSnap.data();
          // Normaliza o texto para caixa baixa ignorando espaços
          const choice = (voteData['choice'] || '').toString().trim().toLowerCase();

          if (choice === 'a favor' || choice === 'aprovar' || choice === 'approved') {
            approved++;
          } else if (choice === 'contra' || choice === 'reprovar' || choice === 'rejected') {
            rejected++;
          } else if (choice === 'abster' || choice === 'abstain') {
            abstain++;
          }
        });

        observer.next({ approved, rejected, abstain, total: snapshot.size });
      }, (error) => {
        observer.error(error);
      });

      return () => unsubscribe();
    });
  }

  // Verifica se o dia da ata já passou (considera até às 23:59:59 da data cadastrada)
  private isAtaExpired(dateStr: string): boolean {
    if (!dateStr) return false;

    const [year, month, day] = dateStr.split('-').map(Number);
    const expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);

    return new Date() > expirationDate;
  }

  // Processa a contagem de votos e encerra a ata definindo o resultado final
  async closeAtaAndCalculateOutcome(ataId: string): Promise<void> {
    const ataDocRef = doc(this.db, 'assemblies', ataId);
    const votesRef = collection(ataDocRef, 'votes');
    
    // Busca todos os votos gravados até o momento
    const snapshot = await getDocs(votesRef);

    let approved = 0;
    let rejected = 0;
    let abstain = 0;

    snapshot.forEach(docSnap => {
      const choice = (docSnap.data()['choice'] || '').toString().trim().toLowerCase();
      if (choice === 'a favor' || choice === 'aprovar' || choice === 'approved') approved++;
      else if (choice === 'contra' || choice === 'reprovar' || choice === 'rejected') rejected++;
      else if (choice === 'abster' || choice === 'abstain') abstain++;
    });

    const total = snapshot.size;
    let outcome: 'approved' | 'rejected' | 'insufficient_votes';
    let statusLabel: string;

    // Regras de decisão do resultado
    if (total === 0) {
      outcome = 'insufficient_votes';
      statusLabel = 'Encerrada (Sem Votos)';
    } else if (approved > rejected) {
      outcome = 'approved';
      statusLabel = 'Aprovada em Assembleia';
    } else {
      outcome = 'rejected';
      statusLabel = 'Reprovada em Assembleia';
    }

    // Grava o status e o resultado no documento principal da ata
    await updateDoc(ataDocRef, {
      status: 'closed',
      outcome: outcome,
      statusLabel: statusLabel
    });
  }
}