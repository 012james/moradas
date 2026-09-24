import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { addDoc, collection, Firestore } from '@angular/fire/firestore';
import { FooterComponent } from '../../shared/footer/footer.component';
import { NavComponent } from '../../shared/nav/nav.component';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-ata-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FooterComponent, NavComponent],
  templateUrl: './ata-create.component.html',
  styleUrls: ['./ata-create.component.scss']
})
export class AtaCreateComponent {
  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  authService = inject(AuthService);

  ataForm: FormGroup;
  isSubmitting = false;
  successMessage = '';

  constructor() {
    this.ataForm = this.fb.group({
      title: ['', Validators.required],
      subtitle: ['', Validators.required],
      description: ['', Validators.required],
      date: ['', Validators.required],
      time: ['', Validators.required],
      location: ['', Validators.required],
      pdfUrl: ['']
    });
  }

  async onSubmit() {
    if (this.ataForm.invalid) return;
    
    this.isSubmitting = true;
    const formValues = this.ataForm.value;

    // Formata a data (Ex: de "2023-10-15" para "15 Out, 2023")
    const [year, month, day] = formValues.date.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const dateFormatted = `${day} ${meses[parseInt(month) - 1]}, ${year}`;

    // Monta o objeto final exatamente como no banco de dados
    const novaAta = {
      ...formValues,
      dateFormatted,
      status: 'open',
      statusLabel: 'Votação em Aberto'
    };

    try {
      const atasRef = collection(this.firestore, 'assemblies');
      await addDoc(atasRef, novaAta);
      
      this.successMessage = 'Assembleia cadastrada com sucesso!';
      this.ataForm.reset();
    } catch (error) {
      console.error('Erro ao criar ata:', error);
      alert('Ocorreu um erro ao salvar a assembleia.');
    } finally {
      this.isSubmitting = false;
    }
  }

  navigateToAprovacoes() {
    // Navega para a página de aprovações de moradores
    window.location.href = '/admin/aprovacoes';
  }
}