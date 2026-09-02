import {HttpClient} from '@angular/common/http';
import {Injectable, inject, signal} from '@angular/core';
import {createInternalNeonAuth} from '@neondatabase/auth';
import {firstValueFrom} from 'rxjs';
import {environment} from '../environments/environment';

export type CheckoraRole = 'SUPERADMIN' | 'OWNER';
export type NeonUser = {id: string; email: string; name: string};
type ProfileResponse = {user: NeonUser & {role: CheckoraRole}};

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly client = createInternalNeonAuth(environment.neonAuthUrl);
  private readonly http = inject(HttpClient);

  readonly user = signal<NeonUser | null>(null);
  readonly role = signal<CheckoraRole | null>(null);

  async restoreSession(): Promise<void> {
    try {
      const response = await this.client.adapter.getSession();
      const user = response.data?.user;

      this.user.set(user ? {id: user.id, email: user.email, name: user.name} : null);
      if (!user) {
        this.role.set(null);
      }
    } catch {
      this.user.set(null);
      this.role.set(null);
    }
  }

  async refreshProfile(): Promise<void> {
    await this.restoreSession();

    if (!this.user()) {
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<ProfileResponse>(`${environment.apiUrl}/auth/me`),
      );

      this.user.set({
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
      });
      this.role.set(response.user.role);
    } catch {
      // La sesión puede ser válida aunque el usuario aún no tenga rol en Checkora.
      this.role.set(null);
    }
  }

  async login(email: string, password: string): Promise<string | null> {
    try {
      const response = await this.client.adapter.signIn.email({email, password});

      if (response.error) {
        return response.error.message ?? 'No se pudo iniciar sesión.';
      }

      await this.restoreSession();
      return null;
    } catch {
      return 'No se pudo iniciar sesión.';
    }
  }

  async signup(name: string, email: string, password: string): Promise<string | null> {
    try {
      const response = await this.client.adapter.signUp.email({name, email, password});
      return response.error?.message ?? null;
    } catch (error) {
      return error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
    }
  }

  async accessToken(): Promise<string | null> {
    return this.client.getJWTToken();
  }

  async logout(): Promise<void> {
    await this.client.adapter.signOut();
    this.user.set(null);
    this.role.set(null);
  }
}
