import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
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

  private allHousePackages$: Observable<PackageItem[]> = this.authService.currentUser$.pipe(
    switchMap((user) => {
      if (!user || user.status !== 'approved' || !user.houseNumber) {
        return of([]);
      }
      return this.packagesService.getPackagesByHouse$(user.houseNumber);
    })
  );

  pendingPackages$: Observable<PackageItem[]> = this.allHousePackages$.pipe(
    map((list) => list.filter((p) => p.status === 'aguardando'))
  );

  deliveredPackages$: Observable<PackageItem[]> = this.allHousePackages$.pipe(
    map((list) => list.filter((p) => p.status === 'entregue'))
  );
}