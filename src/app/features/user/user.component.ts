import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { AuthService } from '../../services/auth/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FooterComponent } from '../../shared/footer/footer.component';
import { NavComponent } from '../../shared/nav/nav.component';

export interface UserProfile {
  name: string;
  unit: string;
  email: string;
  status: 'approved' | 'pending' | 'rejected';
  statusLabel?: string;
  avatarUrl?: string;
}

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FooterComponent, NavComponent],
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss'
})

export class UserComponent implements OnInit {
  authService = inject(AuthService);
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
    this.user.name = (await user).user?.nome.stringValue || '';
    this.user.email = (await user).user?.email.stringValue || '';
    this.user.unit = (await user).user?.casaSolicitada.stringValue || '' ;
    this.user.status = (await user).user?.status.stringValue || 'pending'; // This should be fetched from your backend or user data

    const statusLabels: Record<UserProfile['status'], string> = {
      approved: 'Aprovado',
      pending: 'Pendente',
      rejected: 'Rejeitado',
    };

    this.user.statusLabel = statusLabels[this.user.status];
    this.user.avatarUrl = (await user).googleUser?.photoURL || '';
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