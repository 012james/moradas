import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { switchMap, take } from 'rxjs/operators';

export const registrationGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap(async (firebaseUser) => {
      if (!firebaseUser) {
        return router.createUrlTree(['/login']);
      }

      const snap = await getDoc(doc(firestore, `users/${firebaseUser.uid}`));
      const houseNumber = Number(snap.data()?.['houseNumber']);

      if (!snap.exists() || !houseNumber || houseNumber < 1 || houseNumber > 600) {
        return router.createUrlTree(['/register']);
      }

      return true;
    })
  );
};