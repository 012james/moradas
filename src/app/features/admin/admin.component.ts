import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  Firestore,
  collection,
  query,
  where,
  onSnapshot
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, HasRoleDirective],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  public authService = inject(AuthService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  isLoggingOut = false;

  pendingUsersCount$ = this.watchCount('users', 'status', 'pending');
  pendingPackagesCount$ = this.watchCount('packages', 'status', 'aguardando');
  openAssembliesCount$ = this.watchCount('assemblies', 'status', 'open');

  private watchCount(
    collectionName: string,
    field: string,
    value: string
  ): Observable<number> {
    return new Observable<number>((observer) => {
      const q = query(
        collection(this.firestore, collectionName),
        where(field, '==', value)
      );

      const unsub = onSnapshot(
        q,
        (snap) => observer.next(snap.size),
        () => observer.next(0)
      );

      return () => unsub();
    });
  }

  async logout(): Promise<void> {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    try {
      await this.authService.logout();
      await this.ngZone.run(() =>
        this.router.navigate(['/login'], { replaceUrl: true })
      );
    } catch (error) {
      console.error('Erro ao sair da conta:', error);
      alert('Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      this.ngZone.run(() => {
        this.isLoggingOut = false;
      });
    }
  }
}