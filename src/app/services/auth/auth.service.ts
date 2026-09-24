import { Injectable, inject } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, User, authState } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { map, Observable, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private user: User | undefined;
  private userSnapshot: any;

  // 1. Criamos a variável reativa que o footer e o app.component estão procurando
  // Tipamos como Observable<any> para evitar o erro do "user.role" no HTML
  currentUser$: Observable<any> = authState(this.auth).pipe(
    switchMap(async (firebaseUser) => {
      if (!firebaseUser) return null;
      
      const userDocRef = doc(this.firestore, `users/${firebaseUser.uid}`);
      const userSnap = await getDoc(userDocRef);
      
      return {
        ...firebaseUser,
        ...(userSnap.exists() ? userSnap.data() : {})
      };
    })
  );

  // Acionado no botão "Continuar com Google" da tela de Login
  async loginComGoogle() {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(this.auth, provider);
    this.user = credential.user;

    // Checa se já existe um documento com o UID desse usuário
    const userDocRef = doc(this.firestore, `users/${this.user.uid}`);
    this.userSnapshot = await getDoc(userDocRef);
    console.log('userSnapshot', this.userSnapshot);

    return {
      user: this.user,
      isNovoUsuario: !this.userSnapshot.exists() // Retorna true se for o primeiro acesso
    };
  }

  async getUserInfo() {
    return {
      googleUser: this.user,
      user: this.userSnapshot._document.data.value.mapValue.fields,
    };
  }

  // Retorna true apenas se for morador aprovado ou síndico
  canVote$: Observable<boolean> = this.currentUser$.pipe(
    map(user => user?.status === 'approved')
  );

  // Acionado no botão "Criar Conta" da tela de Cadastro
  async completarCadastro(nomeFormulario: string, rua: string, numeroCasa: string) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuário não está autenticado no Google.');

    const userDocRef = doc(this.firestore, `users/${user.uid}`);
    await setDoc(userDocRef, {
      nome: nomeFormulario || user.displayName, // Usa o digitado ou o padrão do Google
      email: user.email,
      role: 'morador',
      casaSolicitada: `${rua} - ${numeroCasa}`,
      status: this.userSnapshot.statusAprovacao || 'pendente',
      unitId: this.userSnapshot.unitId || null,
      createdAt: new Date().toISOString()
    });
  }
}