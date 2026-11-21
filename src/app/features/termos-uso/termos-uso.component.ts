import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-termos-uso',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './termos-uso.component.html',
  styleUrls: ['./termos-uso.component.scss']
})
export class TermosUsoComponent {
  private location = inject(Location);
  private router = inject(Router);

  voltar(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/login']);
    }
  }
}