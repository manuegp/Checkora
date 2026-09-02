import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {TuiButton, TuiNotificationService} from '@taiga-ui/core';
import {AuthService} from '../../auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TuiButton],
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
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set('');
    const error = await this.auth.login(
      this.form.controls.email.value,
      this.form.controls.password.value,
    );

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
