import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {TuiButton, TuiLoader, TuiNotificationService} from '@taiga-ui/core';
import {AuthService} from '../../auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiLoader],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(TuiNotificationService);

  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
    if (this.loading()) {
      return;
    }

      this.form.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.loading.set(true);
    const error = await this.auth.login(this.form.controls.email.value, this.form.controls.password.value);
    this.loading.set(false);

    if (error) {
      const message = 'El correo electrónico o la contraseña no son correctos.';
      this.error.set(message);
      this.notifications
        .open(message, {
          appearance: 'negative',
          autoClose: 5_000,
          label: 'No se ha podido iniciar sesión',
        })
        .subscribe();
      return;
    }

    await this.router.navigateByUrl('/dashboard');
  }
}
