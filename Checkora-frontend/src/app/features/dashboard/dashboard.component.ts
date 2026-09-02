import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth.service';

type Submission = {
  id: string;
  email: string;
  first_name: string;
  first_surname: string;
  submitted_at: string;
};
type OwnerSummary = {
  auth_user_id: string;
  name: string | null;
  email: string | null;
  submissions: number;
  checkin_url: string | null;
};
type Dashboard =
  | { role: 'SUPERADMIN'; owners: OwnerSummary[] }
  | { role: 'OWNER'; submissions: Submission[] };

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(true);

  constructor() {
    this.load();
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
