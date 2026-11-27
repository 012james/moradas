import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from '@angular/fire/firestore';
import { UserProfile } from '../../shared/models/user.model';

@Component({
  selector: 'app-sindico-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sindico-approval.component.html',
  styleUrls: ['./sindico-approval.component.scss']
})
export class SindicoApprovalComponent implements OnInit, OnDestroy {
  private app = inject(FirebaseApp);
  private db = getFirestore(this.app);
  private auth = getAuth(this.app);
  private ngZone = inject(NgZone);
  private unsub?: () => void;

  allUsers: UserProfile[] = [];
  activeTab: 'pending' | 'approved' = 'pending';
  searchTerm = '';

  // Guarda o papel escolhido temporariamente no card antes de aprovar
  selectedRoles: Record<string, UserProfile['role']> = {};
  processingId: string | null = null;
  feedbackToast = '';

  get currentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  ngOnInit(): void {
    const usersRef = collection(this.db, 'users');

    this.unsub = onSnapshot(usersRef, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const user = {
          id: docSnap.id,
          ...data,
          role: data['role'] || 'morador'
        } as unknown as UserProfile;

        if (!this.selectedRoles[user.id]) {
          this.selectedRoles[user.id] = user.role;
        }
        return user;
      });

      // Ordena por número da casa para facilitar conferência
      list.sort((a, b) => (Number(a.houseNumber) || 999) - (Number(b.houseNumber) || 999));

      this.ngZone.run(() => {
        this.allUsers = list;
      });
    });
  }

  ngOnDestroy(): void {
    if (this.unsub) this.unsub();
  }

  get pendingCount(): number {
    return this.allUsers.filter((u) => u.status === 'pending').length;
  }

  get approvedCount(): number {
    return this.allUsers.filter((u) => u.status === 'approved').length;
  }

  get filteredUsers(): UserProfile[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.allUsers
      .filter((u) => u.status === this.activeTab)
      .filter((u) => {
        if (!term) return true;
        const matchName = u.name?.toLowerCase().includes(term);
        const matchEmail = u.email?.toLowerCase().includes(term);
        const matchStreet = u.street?.toLowerCase().includes(term);
        const matchHouse = String(u.houseNumber || '').includes(term);
        return matchName || matchEmail || matchStreet || matchHouse;
      });
  }

  selectRoleForUser(userId: string, role: UserProfile['role']): void {
    this.selectedRoles[userId] = role;
  }

  async approveOrRejectUser(user: UserProfile, status: 'approved' | 'rejected'): Promise<void> {
    if (!user.id) return;
    this.processingId = user.id;

    try {
      const userRef = doc(this.db, 'users', user.id);

      // Se recusado, exclui o cadastro para permitir que o morador preencha novamente
      if (status === 'rejected') {
        await deleteDoc(userRef);
        delete this.selectedRoles[user.id];
        this.showToast(`Cadastro de ${user.name} recusado e excluído para novo envio.`);
        return;
      }

      const assignedRole = this.selectedRoles[user.id] || user.role || 'morador';
      await updateDoc(userRef, {
        status: 'approved',
        role: assignedRole
      });

      this.showToast(`${user.name} aprovado como ${assignedRole.toUpperCase()}!`);
    } catch (error) {
      console.error('Erro ao processar solicitação:', error);
      this.showToast('Não foi possível concluir a ação. Verifique suas permissões.');
    } finally {
      this.ngZone.run(() => {
        this.processingId = null;
      });
    }
  }

  async updateActiveUserRole(user: UserProfile, newRole: UserProfile['role']): Promise<void> {
    if (!user.id || user.role === newRole) return;
    this.processingId = user.id;

    try {
      const userRef = doc(this.db, 'users', user.id);
      await updateDoc(userRef, { role: newRole });
      this.selectedRoles[user.id] = newRole;
      this.showToast(`Perfil de ${user.name} alterado para ${newRole.toUpperCase()}.`);
    } finally {
      this.ngZone.run(() => {
        this.processingId = null;
      });
    }
  }

  async deleteUser(user: UserProfile): Promise<void> {
    if (!user?.id || this.processingId) return;

    if (user.id === this.currentUserId) {
      this.showToast('Você não pode excluir o seu próprio cadastro.');
      return;
    }

    const label = `${user.name || 'este morador'} (Casa ${user.houseNumber || '--'})`;
    const confirmed = confirm(
      `Tem certeza que deseja excluir permanentemente o cadastro de ${label}?\n\nO acesso ao aplicativo será revogado imediatamente.`
    );

    if (!confirmed) return;

    this.processingId = user.id;
    try {
      await deleteDoc(doc(this.db, 'users', user.id));
      delete this.selectedRoles[user.id];
      this.showToast(`Cadastro de ${user.name} excluído com sucesso.`);
    } catch (error) {
      console.error('Erro ao excluir morador:', error);
      this.showToast('Não foi possível excluir o cadastro. Verifique suas permissões.');
    } finally {
      this.ngZone.run(() => {
        this.processingId = null;
      });
    }
  }

  getInitials(name?: string): string {
    if (!name) return 'CM';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private showToast(msg: string): void {
    this.ngZone.run(() => {
      this.feedbackToast = msg;
      setTimeout(() => (this.feedbackToast = ''), 3500);
    });
  }
}