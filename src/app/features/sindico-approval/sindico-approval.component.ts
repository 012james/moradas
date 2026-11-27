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
  query,
  where,
  getDocs,
  getCountFromServer,
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
  private unsubPending?: () => void;

  pendingUsers: UserProfile[] = [];
  approvedUsers: UserProfile[] = [];

  activeTab: 'pending' | 'approved' = 'pending';
  searchTerm = '';

  approvedLoaded = false;
  isLoadingApproved = false;
  approvedTotalCount = 0;

  selectedRoles: Record<string, UserProfile['role']> = {};
  processingId: string | null = null;
  feedbackToast = '';

  get currentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  ngOnInit(): void {
    const usersRef = collection(this.db, 'users');

    // 1. Escuta em tempo real APENAS os cadastros pendentes
    const pendingQuery = query(usersRef, where('status', '==', 'pending'));
    this.unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => this.mapUserDoc(docSnap.id, docSnap.data()));
      this.sortByHouse(list);

      this.ngZone.run(() => {
        this.pendingUsers = list;
      });
    });

    // 2. Busca apenas a contagem dos aprovados (custa 1 leitura, sem baixar os documentos)
    this.loadApprovedCount();
  }

  ngOnDestroy(): void {
    if (this.unsubPending) this.unsubPending();
  }

  private async loadApprovedCount(): Promise<void> {
    try {
      const approvedQuery = query(
        collection(this.db, 'users'),
        where('status', '==', 'approved')
      );
      const countSnap = await getCountFromServer(approvedQuery);
      this.ngZone.run(() => {
        this.approvedTotalCount = countSnap.data().count;
      });
    } catch (error) {
      console.error('Erro ao contar moradores aprovados:', error);
    }
  }

  // Chamado ao clicar nas abas no HTML
  async setTab(tab: 'pending' | 'approved'): Promise<void> {
    this.activeTab = tab;

    if (tab === 'approved' && !this.approvedLoaded) {
      await this.loadApprovedUsers();
    }
  }

  async loadApprovedUsers(forceReload = false): Promise<void> {
    if (this.isLoadingApproved || (this.approvedLoaded && !forceReload)) return;

    this.isLoadingApproved = true;
    try {
      const approvedQuery = query(
        collection(this.db, 'users'),
        where('status', '==', 'approved')
      );
      const snapshot = await getDocs(approvedQuery);
      const list = snapshot.docs.map((docSnap) => this.mapUserDoc(docSnap.id, docSnap.data()));
      this.sortByHouse(list);

      this.ngZone.run(() => {
        this.approvedUsers = list;
        this.approvedTotalCount = list.length;
        this.approvedLoaded = true;
      });
    } catch (error) {
      console.error('Erro ao carregar moradores aprovados:', error);
      this.showToast('Erro ao carregar a lista de moradores aprovados.');
    } finally {
      this.ngZone.run(() => {
        this.isLoadingApproved = false;
      });
    }
  }

  get pendingCount(): number {
    return this.pendingUsers.length;
  }

  get approvedCount(): number {
    return this.approvedLoaded ? this.approvedUsers.length : this.approvedTotalCount;
  }

  get filteredUsers(): UserProfile[] {
    const sourceList = this.activeTab === 'pending' ? this.pendingUsers : this.approvedUsers;
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) return sourceList;

    return sourceList.filter((u) => {
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

      // Atualiza a lista ou o contador local sem precisar consultar o Firebase novamente
      this.ngZone.run(() => {
        if (this.approvedLoaded) {
          const updatedUser: UserProfile = { ...user, status: 'approved', role: assignedRole };
          this.approvedUsers = [...this.approvedUsers, updatedUser];
          this.sortByHouse(this.approvedUsers);
          this.approvedTotalCount = this.approvedUsers.length;
        } else {
          this.approvedTotalCount += 1;
        }
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

      this.ngZone.run(() => {
        user.role = newRole;
        this.selectedRoles[user.id] = newRole;
      });

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

      // Remove localmente da aba de aprovados sem precisar refazer getDocs
      this.ngZone.run(() => {
        if (this.approvedLoaded) {
          this.approvedUsers = this.approvedUsers.filter((u) => u.id !== user.id);
          this.approvedTotalCount = this.approvedUsers.length;
        } else {
          this.approvedTotalCount = Math.max(0, this.approvedTotalCount - 1);
        }
      });

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

  private mapUserDoc(id: string, data: Record<string, any>): UserProfile {
    const user = {
      id,
      ...data,
      role: data['role'] || 'morador'
    } as unknown as UserProfile;

    if (!this.selectedRoles[user.id]) {
      this.selectedRoles[user.id] = user.role;
    }
    return user;
  }

  private sortByHouse(list: UserProfile[]): void {
    list.sort((a, b) => (Number(a.houseNumber) || 999) - (Number(b.houseNumber) || 999));
  }

  private showToast(msg: string): void {
    this.ngZone.run(() => {
      this.feedbackToast = msg;
      setTimeout(() => (this.feedbackToast = ''), 3500);
    });
  }
}