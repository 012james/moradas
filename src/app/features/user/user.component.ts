import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import { PackagesService } from '../../services/packages/packages.service';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { FirebaseApp } from '@angular/fire/app';
import { doc, getFirestore, updateDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HasRoleDirective],
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class PerfilComponent {
  public authService = inject(AuthService);
  private packagesService = inject(PackagesService);
  private router = inject(Router);
  // Adicione FormsModule no array imports do @Component e inclua na classe PerfilComponent:
  private db = getFirestore(inject(FirebaseApp));
  editingPhone = false;
  phoneInput = '';
  savingPhone = false;
  phoneFeedback = '';

  user$ = this.authService.currentUser$;

  startEditPhone(currentPhone?: string): void {
  this.phoneInput = currentPhone || '';
  this.editingPhone = true;
}

async savePhone(userId: string): Promise<void> {
  const digits = this.phoneInput.replace(/\D/g, '');
  if (digits.length < 10) {
    this.phoneFeedback = 'Informe o DDD + número com pelo menos 10 dígitos.';
    return;
  }

  this.savingPhone = true;
  try {
    await updateDoc(doc(this.db, 'users', userId), { phone: digits });
    this.editingPhone = false;
    this.phoneFeedback = 'WhatsApp atualizado com sucesso!';
    setTimeout(() => (this.phoneFeedback = ''), 3000);
  } finally {
    this.savingPhone = false;
  }
}

  houseStats$ = this.user$.pipe(
    switchMap((user) =>
      user?.status === 'approved' && user.houseNumber
        ? this.packagesService.getPackagesByHouse$(user.houseNumber)
        : of([])
    ),
    map((pkgs) => ({
      pending: pkgs.filter((p) => p.status === 'aguardando').length,
      delivered: pkgs.filter((p) => p.status === 'entregue').length
    }))
  );

  getInitials(name?: string): string {
    if (!name) return 'CM';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getRoleLabel(role?: string): string {
    if (role === 'sindico') return 'Síndico Administrador';
    if (role === 'porteiro') return 'Equipe da Portaria';
    return 'Morador Titular / Familiar';
  }

  async onLogout(): Promise<void> {
    // await this.authService.logout();
    this.router.navigate(['/login']);
  }
}