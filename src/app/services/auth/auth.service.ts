import { Injectable, inject } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private user: User | undefined;
  private userSnapshot: any;

  // Acionado no botão "Continuar com Google" da tela de Login
  async loginComGoogle() {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(this.auth, provider);
    this.user = credential.user;

    // Checa se já existe um documento com o UID desse usuário
    const userDocRef = doc(this.firestore, `users/${this.user.uid}`);
    this.userSnapshot = await getDoc(userDocRef);

    return {
      user: this.user,
      isNovoUsuario: !this.userSnapshot.exists() // Retorna true se for o primeiro acesso
    };
  }

  async getUserInfo() {
    return {
      user: this.user,
    };
  }

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
      statusAprovacao: 'pendente',
      unitId: null,
      createdAt: new Date().toISOString()
    });
  }
}