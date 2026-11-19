import { Injectable, inject, NgZone } from '@angular/core';
import {
  Auth,
  authState,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);

  private user: User | undefined;
  private userSnapshot: any;
  phone: string = '';

  private currentUserSubject = new BehaviorSubject<any>(undefined);

  // Emite null se deslogado ou o objeto mesclado (Auth + Firestore)
  currentUser$: Observable<any> = this.currentUserSubject.pipe(
    map((u) => (u === undefined ? null : u))
  );

  private profileUnsub?: () => void;

  constructor() {
    authState(this.auth).subscribe((firebaseUser) => {
      this.profileUnsub?.();

      if (!firebaseUser) {
        this.ngZone.run(() => this.currentUserSubject.next(null));
        return;
      }

      const userDocRef = doc(this.firestore, `users/${firebaseUser.uid}`);
      this.profileUnsub = onSnapshot(
        userDocRef,
        (snap) => {
          this.userSnapshot = snap;
          const data = snap.exists() ? snap.data() : {};
          this.ngZone.run(() => {
            this.currentUserSubject.next({
              ...firebaseUser,
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              ...data
            });
          });
        },
        (err) => {
          console.error('Erro ao escutar perfil no Firestore:', err);
          this.ngZone.run(() => {
            this.currentUserSubject.next({
              ...firebaseUser,
              id: firebaseUser.uid,
              uid: firebaseUser.uid
            });
          });
        }
      );
    });
  }

  getCurrentFirebaseUser(): User | null {
    return this.auth.currentUser;
  }

  async loginComGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const credential = await signInWithPopup(this.auth, provider);
    this.user = credential.user;

    const userDocRef = doc(this.firestore, `users/${this.user.uid}`);
    this.userSnapshot = await getDoc(userDocRef);

    const data = this.userSnapshot.exists() ? this.userSnapshot.data() : {};

    // Já atualiza o currentUserSubject sincronamente ANTES de navegar
    this.currentUserSubject.next({
      ...this.user,
      id: this.user.uid,
      uid: this.user.uid,
      ...data
    });

    const hasValidHouse =
      this.userSnapshot.exists() &&
      Number(data?.['houseNumber']) >= 1 &&
      Number(data?.['houseNumber']) <= 600;

    return {
      user: this.user,
      isNovoUsuario: !hasValidHouse
    };
  }

  async getUserInfo() {
    return {
      googleUser: this.user || this.auth.currentUser,
      user: this.userSnapshot?._document?.data?.value?.mapValue?.fields || null
    };
  }

  canVote$: Observable<boolean> = this.currentUser$.pipe(
    map((user) => user?.status === 'approved')
  );

  async completarCadastro(
    nomeFormulario: string,
    rua: string,
    numeroCasa: string | number,
    telefone?: string
  ) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuário não está autenticado no Google.');

    const houseNumber = Number(numeroCasa);
    if (!Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 600) {
      throw new Error('Informe um número de casa válido entre 1 e 600.');
    }

    const cleanPhone = (telefone ?? this.phone ?? '').replace(/\D/g, '');
    const finalName = (nomeFormulario || user.displayName || 'Morador').trim();
    const existingData = this.userSnapshot?.exists?.()
      ? this.userSnapshot.data()
      : {};

    const payload = {
      uid: user.uid,
      name: finalName,
      nome: finalName,
      email: user.email || '',
      role: 'morador',
      status: 'pending',
      houseNumber,
      street: rua.trim(),
      rua: rua.trim(),
      casaSolicitada: `${rua.trim()} - ${houseNumber}`,
      phone: cleanPhone,
      unitId: existingData?.['unitId'] || null,
      createdAt: Date.now()
    };

    const userDocRef = doc(this.firestore, `users/${user.uid}`);
    await setDoc(userDocRef, payload);

    this.currentUserSubject.next({
      ...user,
      id: user.uid,
      ...payload
    });
  }

  async logout(): Promise<void> {
    this.profileUnsub?.();
    await signOut(this.auth);
    this.currentUserSubject.next(null);
  }

  readonly isSindico$: Observable<boolean> = this.currentUser$.pipe(
    map((user) => user?.status === 'approved' && user?.role === 'sindico')
  );

  readonly isPorteiro$: Observable<boolean> = this.currentUser$.pipe(
    map((user) => user?.status === 'approved' && user?.role === 'porteiro')
  );

  readonly isManagement$ = this.currentUser$.pipe(
    map((u) => !!u && ['secretaria', 'sindico'].includes(u.role))
  );

  readonly isStaff$: Observable<boolean> = this.currentUser$.pipe(
    map((u) => !!u && ['secretaria', 'sindico', 'porteiro'].includes(u.role))
  );
}