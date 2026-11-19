import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { NavComponent } from '../../shared/nav/nav.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NavComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  registerForm!: FormGroup;
  phone = '';
  focusedField: string | null = null;
  isSubmitting = false;

  streetOptions = [
    'Rua 1',
    'Rua 2',
    'Rua 3',
    'Rua 4',
    'Rua 5',
    'alameda 1',
    'alameda 2',
    'alameda 3',
    'alameda 4',
    'alameda 5',
  ];

  ngOnInit(): void {
    const googleName = this.authService.getCurrentFirebaseUser()?.displayName || '';

    this.registerForm = this.fb.group({
      nome: [googleName, [Validators.required, Validators.minLength(3)]],
      rua: ['', [Validators.required]],
      numero: ['', [Validators.required, Validators.min(1), Validators.max(600)]]
    });
  }

  onFocus(fieldName: string): void {
    this.focusedField = fieldName;
  }

  onBlur(): void {
    this.focusedField = null;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  goBack(): void {
    this.router.navigate(['/login']);
  }

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid || this.isSubmitting) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    try {
      const { nome, rua, numero } = this.registerForm.value;
      this.authService.phone = this.phone;
      await this.authService.completarCadastro(nome, rua, numero, this.phone);
      alert('Cadastro enviado! O síndico fará a liberação.');
      await this.router.navigate(['/atas']);
    } catch (error: any) {
      alert(error?.message || 'Erro ao finalizar cadastro.');
      console.error(error);
    } finally {
      this.isSubmitting = false;
    }
  }
}