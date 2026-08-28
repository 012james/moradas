import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  // Variáveis que vêm dos inputs do seu HTML (usando ngModel ou FormBuilder)
  isLoading = false;
 
  async loginWithGoogle(): Promise<void> {
    this.isLoading = true;

    try {
      const resultado = await this.authService.loginComGoogle();
      console.log('Usuário:', resultado);
      if (resultado.isNovoUsuario) {
        this.router.navigate(['/register']);
        return;
      } else {
        this.router.navigate(['/atas']);
      }

    } catch (error) {
      console.error('Erro login Google:', error);
    }
  }
}