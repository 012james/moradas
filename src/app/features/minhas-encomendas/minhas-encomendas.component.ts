import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { switchMap, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../../services/auth/auth.service';
import { PackagesService } from '../../services/packages/packages.service';
import { PackageItem } from '../../shared/models/package.model';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-minhas-encomendas',
  standalone: true,
  imports: [CommonModule, HasRoleDirective, RouterModule],
  templateUrl: './minhas-encomendas.component.html',
  styleUrls: ['./minhas-encomendas.component.scss']
})
export class MinhasEncomendasComponent {
  public authService = inject(AuthService);
  private packagesService = inject(PackagesService);

  private approvedHouse$ = this.authService.currentUser$.pipe(
    distinctUntilChanged(
      (prev, curr) =>
        prev?.houseNumber === curr?.houseNumber && prev?.status === curr?.status
    )
  );

  pendingPackages$: Observable<PackageItem[]> = this.approvedHouse$.pipe(
    switchMap((user) => {
      if (!user || user.status !== 'approved' || !user.houseNumber) {
        return of([]);
      }
      return this.packagesService.getPendingPackagesByHouse$(user.houseNumber);
    })
  );

  deliveredPackages$: Observable<PackageItem[]> = this.approvedHouse$.pipe(
    switchMap((user) => {
      if (!user || user.status !== 'approved' || !user.houseNumber) {
        return of([]);
      }
      return this.packagesService.getDeliveredPackagesByHouse$(user.houseNumber, 15);
    })
  );
}