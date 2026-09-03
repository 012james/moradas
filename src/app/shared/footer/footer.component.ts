import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  @Input() currentTab: string = 'avisos';
  // Injetamos o serviço para ter acesso ao currentUser$ em tempo real
  public authService = inject(AuthService);
  private router = inject(Router);

  openProfile(): void {
    this.router.navigate(['/user']);
    this.currentTab = 'perfil';
  }

  openAtas(): void {
    this.router.navigate(['/atas']);
    this.currentTab = 'atas';
  }

  openAtasCreate(): void {
    this.router.navigate(['/new-ata']);
    this.currentTab = 'atas';
  }

  // openAvisos(): void {
  //   this.router.navigate(['/user']);
  // }
}