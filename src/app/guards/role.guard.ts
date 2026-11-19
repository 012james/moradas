import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { UserProfile } from '../shared/models/user.model';
import { AuthService } from '../services/auth/auth.service';


export const roleGuard = (allowedRoles: UserProfile['role'][]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
      take(1),
      map((user) => {
        if (user && allowedRoles.includes(user.role)) {
          return true;
        }
        return router.createUrlTree(['/atas']);
      })
    );
  };
};