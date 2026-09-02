import {Routes} from '@angular/router';
import {authenticatedGuard} from './guards/auth.guard';
import {superadminGuard} from './guards/superadmin.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('./layouts/private-layout/private-layout.component').then(
        (module) => module.PrivateLayoutComponent,
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (module) => module.DashboardComponent,
          ),
      },
      {
        path: 'owners',
        canActivate: [superadminGuard],
        loadComponent: () =>
          import('./features/owners/owners.component').then((module) => module.OwnersComponent),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((module) => module.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/signup/signup.component').then((module) => module.SignupComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then(
        (module) => module.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password.component').then(
        (module) => module.ResetPasswordComponent,
      ),
  },
  {
    path: 'checkin/:token',
    loadComponent: () =>
      import('./features/checkin/checkin-form.component').then(
        (module) => module.CheckinFormComponent,
      ),
  },
  {path: '', pathMatch: 'full', redirectTo: 'login'},
  {path: '**', redirectTo: 'login'},
];
