import { Component, inject, NgZone } from '@angular/core';
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
  private ngZone = inject(NgZone);

  isLoading = false;
  errorMsg = '';

  async loginWithGoogle(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    this.errorMsg = '';

    try {
      const resultado = await this.authService.loginComGoogle();
      const targetRoute = resultado.isNovoUsuario ? '/register' : '/atas';

      await this.ngZone.run(() => this.router.navigateByUrl(targetRoute));
    } catch (error: any) {
      console.error('Erro login Google:', error);
      this.ngZone.run(() => {
        this.errorMsg =
          error?.code === 'permission-denied'
            ? 'Permissão negada no Firestore. Publique as firestore.rules no Console do Firebase.'
            : error?.message || 'Não foi possível concluir o login com Google.';
      });
    } finally {
      this.ngZone.run(() => {
        this.isLoading = false;
      });
    }
  }
}