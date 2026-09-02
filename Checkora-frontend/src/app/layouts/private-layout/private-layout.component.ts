import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {Router, RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TuiButton} from '@taiga-ui/core';
import {AuthService} from '../../auth.service';

@Component({
  selector: 'app-private-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TuiButton],
  templateUrl: './private-layout.component.html',
  styleUrl: './private-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateLayoutComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
