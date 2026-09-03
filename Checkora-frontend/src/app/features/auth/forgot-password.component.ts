import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {TuiButton, TuiNotificationService} from '@taiga-ui/core';
import {AuthService} from '../../auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, TuiButton],
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
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    const email = this.route.snapshot.queryParamMap.get('email')?.trim();
    if (email) this.form.controls.email.setValue(email);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set('');
    const error = await this.auth.requestPasswordReset(this.form.controls.email.value);

    if (error) {
      this.error.set(error);
      this.notifications.open(error, {appearance: 'negative', autoClose: 5_000}).subscribe();
      return;
    }

    this.submitted.set(true);
  }
}
