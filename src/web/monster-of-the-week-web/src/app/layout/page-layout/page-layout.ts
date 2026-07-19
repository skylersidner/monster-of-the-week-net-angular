import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NotificationService } from '../../core/notifications';

@Component({
  selector: 'app-page-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './page-layout.html',
  styleUrl: './page-layout.scss',
})
export class PageLayoutComponent {
  constructor(readonly notificationService: NotificationService) {}
}
