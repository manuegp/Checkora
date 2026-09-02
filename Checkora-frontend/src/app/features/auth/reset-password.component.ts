import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {TuiButton, TuiNotificationService} from '@taiga-ui/core';
import {AuthService} from '../../auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, RouterLink, TuiButton],
  templateUrl: './reset-password.component.html',
  styleUrl: './auth-pages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(TuiNotificationService);
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly form = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(128)]],
    confirmation: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (!this.token) {
      this.error.set('El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Crea una contraseña de entre 12 y 128 caracteres y repítela.');
      return;
    }

    if (this.form.controls.password.value !== this.form.controls.confirmation.value) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.error.set('');
    this.saving.set(true);
    const error = await this.auth.resetPassword(this.token, this.form.controls.password.value);
    this.saving.set(false);

    if (error) {
      this.error.set(error);
      this.notifications.open(error, {appearance: 'negative', autoClose: 5_000}).subscribe();
      return;
    }

    this.notifications
      .open('Tu contraseña se ha actualizado. Ya puedes iniciar sesión.', {
        appearance: 'positive',
        autoClose: 5_000,
      })
      .subscribe();
    await this.router.navigateByUrl('/login');
  }
}
