import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {TuiButton, TuiLoader, TuiNotificationService} from '@taiga-ui/core';
import {AuthService} from '../../auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, TuiButton, TuiLoader],
  templateUrl: './forgot-password.component.html',
  styleUrl: './auth-pages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(TuiNotificationService);

  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const email = this.route.snapshot.queryParamMap.get('email')?.trim();
    if (email) this.form.controls.email.setValue(email);
  }

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
    const error = await this.auth.requestPasswordReset(this.form.controls.email.value);
    this.loading.set(false);

    if (error) {
      this.error.set(error);
      this.notifications.open(error, {appearance: 'negative', autoClose: 5_000}).subscribe();
      return;
    }

    this.submitted.set(true);
  }
}
