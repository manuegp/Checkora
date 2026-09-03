import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiHint, TuiNotificationService } from '@taiga-ui/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth.service';

type Submission = {
  id: string;
  email: string;
  first_name: string;
  first_surname: string;
  submitted_at: string;
  owner_name: string | null;
  owner_email: string | null;
  second_surname: string | null;
  gender: string | null;
  document_type: string | null;
  document_number: string | null;
  document_support_number: string | null;
  nationality: string | null;
  birth_date: string | null;
  mobile_phone: string | null;
  habitual_residence: string | null;
  address: string | null;
  postal_code: string | null;
  municipality: string | null;
  signature_url: string | null;
  privacy_accepted_at: string;
};
type OwnerSummary = {
  auth_user_id: string;
  name: string | null;
  email: string | null;
  submissions: number;
  checkin_url: string | null;
};
type Dashboard =
  | { role: 'SUPERADMIN'; owners: OwnerSummary[]; submissions: Submission[] }
  | { role: 'OWNER'; submissions: Submission[] };

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, TuiButton, TuiHint],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly notifications = inject(TuiNotificationService);

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(true);
  protected readonly selectedSubmission = signal<Submission | null>(null);

  constructor() {
    this.load();
  }

  protected async copyFormUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.notifications
        .open('La URL del formulario se ha copiado al portapapeles.', {
          appearance: 'positive',
          autoClose: 3_000,
          label: 'URL copiada',
        })
        .subscribe();
    } catch {
      this.notifications
        .open('No se ha podido copiar la URL. Selecciónala y cópiala manualmente.', {
          appearance: 'negative',
          autoClose: 5_000,
          label: 'No se ha podido copiar',
        })
        .subscribe();
    }
  }

  protected valueOrDash(value: string | null): string {
    return value?.trim() || '-';
  }

  protected documentTypeLabel(value: string | null): string {
    const labels: Record<string, string> = {dni: 'DNI', nie: 'NIE', passport: 'Pasaporte', other: 'Otro'};
    return value ? labels[value] ?? value : '-';
  }

  protected openSubmission(submission: Submission): void {
    this.selectedSubmission.set(submission);
  }

  protected closeSubmission(): void {
    this.selectedSubmission.set(null);
  }

  private load(): void {
    this.http.get<Dashboard>(`${environment.apiUrl}/dashboard`).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se han podido cargar los resultados.');
        this.loading.set(false);
      },
    });
  }
}
