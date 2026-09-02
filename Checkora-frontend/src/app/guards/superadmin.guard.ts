import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {AuthService} from '../auth.service';

export const superadminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.refreshProfile();

  if (!auth.user()) {
    return router.createUrlTree(['/login']);
  }

  return auth.role() === 'SUPERADMIN'
    ? true
    : router.createUrlTree(['/dashboard']);
};
