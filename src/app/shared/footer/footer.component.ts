import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { PackagesService } from '../../services/packages/packages.service';
import { map, of, switchMap } from 'rxjs';
import { InvoicesService } from '../../services/invoices/invoices.service';
import { HasRoleDirective } from '../directives/has-role.directive';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule, HasRoleDirective],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  @Input() currentTab: string = 'avisos';
  // Injetamos o serviço para ter acesso ao currentUser$ em tempo real
  public authService = inject(AuthService);
  private router = inject(Router);
  private packagesService = inject(PackagesService);
  private invoicesService = inject(InvoicesService);
  // Controla se o botão Admin/Portaria aparece no rodapé
  isStaff$ = this.authService.isStaff$;

// Contador vermelho de encomendas aguardando retirada
  pendingPackagesCount$ = this.authService.currentUser$.pipe(
    switchMap((user) =>
      user?.status === 'approved' && user.houseNumber
        ? this.packagesService.getPackagesByHouse$(user.houseNumber)
        : of([])
    ),
    map((pkgs) => pkgs.filter((p) => p.status === 'aguardando').length)
  );

  // Contador de boletos em aberto da unidade
  openInvoicesCount$ = this.authService.currentUser$.pipe(
    switchMap((user) =>
      user?.status === 'approved' && user.houseNumber
        ? this.invoicesService.getInvoicesByHouse$(user.houseNumber)
        : of([])
    ),
    map((invs) => invs.filter((i) => i.status !== 'pago').length)
  );

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