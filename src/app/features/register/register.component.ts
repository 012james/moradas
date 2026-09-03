import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { NavComponent } from '../../shared/nav/nav.component';
 
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NavComponent],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  registerForm!: FormGroup;
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
    this.registerForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(3)]],
      rua: ['', [Validators.required]],
      numero: ['', [Validators.required]]
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
    try {
      await this.authService.completarCadastro(this.registerForm.get('nome')?.value, this.registerForm.get('rua')?.value, this.registerForm.get('numero')?.value);
      alert('Cadastro enviado! O síndico fará a liberação.');
      this.router.navigate(['/atas']);
    } catch (error) {
      alert('Erro ao finalizar cadastro.');
      console.error(error);
    }
  }
}