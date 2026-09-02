import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
export const neonAuthInterceptor: HttpInterceptorFn = (request, next) => from(inject(AuthService).accessToken()).pipe(switchMap((token) => next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request)));
