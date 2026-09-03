import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiButton, TuiNotificationService} from '@taiga-ui/core';
import {firstValueFrom} from 'rxjs';
import {environment} from '../../../environments/environment';

type CreateOwnerResponse = {
  owner: {id: string; name: string; email: string};
  checkinUrl: string;
};

@Component({
  selector: 'app-owners',
  imports: [ReactiveFormsModule, TuiButton],
  templateUrl: './owners.component.html',
  styleUrl: './owners.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnersComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(TuiNotificationService);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
  });
  protected readonly error = signal('');
  protected readonly createdOwner = signal<CreateOwnerResponse | null>(null);
  protected readonly saving = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Completa nombre y email válido.');
      return;
    }

    this.error.set('');
    this.createdOwner.set(null);
    this.saving.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<CreateOwnerResponse>(`${environment.apiUrl}/admin/owners`, this.form.getRawValue()),
      );

      this.createdOwner.set(response);
      this.form.reset();
      this.notifications
        .open('La cuenta se ha creado y se ha enviado el correo de activación al propietario.', {
          appearance: 'positive',
          autoClose: 5_000,
          label: 'Propietario creado',
        })
        .subscribe();
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.error.set(message);
      this.notifications
        .open(message, {
          appearance: 'negative',
          autoClose: 5_000,
          label: 'No se ha podido crear el propietario',
        })
        .subscribe();
    } finally {
      this.saving.set(false);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (
      error instanceof HttpErrorResponse &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'error' in error.error &&
      typeof error.error.error === 'string'
    ) {
      return error.error.error;
    }

    return 'No se ha podido crear el propietario. Inténtalo de nuevo.';
  }
}


