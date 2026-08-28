import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

export interface UserProfile {
  name: string;
  unit: string;
  email: string;
  status: 'approved' | 'pending' | 'suspended';
  statusLabel?: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss'
})

export class UserComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  @Input() user: UserProfile = {
    name: '',
    unit: '',
    email: '',
    status: 'pending',
    statusLabel: '',
    avatarUrl: '',
  }
  currentTab: 'atas' | 'avisos' | 'perfil' = 'perfil';

  async ngOnInit(): Promise<void> {
   const user = this.authService.getUserInfo();
   if(user) {
    this.user.name = (await user).user?.displayName || '';
    this.user.email = (await user).user?.email || '';
    this.user.unit = 'Apto 101';
    this.user.status = 'suspended'; // This should be fetched from your backend or user data

    const statusLabels: Record<UserProfile['status'], string> = {
      approved: 'Aprovado',
      pending: 'Pendente',
      suspended: 'Suspenso',
    };

    this.user.statusLabel = statusLabels[this.user.status];
    this.user.avatarUrl = (await user).user?.photoURL || '';
   }
  
   console.log('aqui', user);
  }

  selectTab(tab: 'atas' | 'avisos' | 'perfil'): void {
    this.currentTab = tab;
  }

  logoutUser(): void {
    this.router.navigate(['/login']);
  }
} 