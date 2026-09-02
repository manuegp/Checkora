import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {AuthService} from '../auth.service';

export const authenticatedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.refreshProfile();
  return auth.user() ? true : router.createUrlTree(['/login']);
};
