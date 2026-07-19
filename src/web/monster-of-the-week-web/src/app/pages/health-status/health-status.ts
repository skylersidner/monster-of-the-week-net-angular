import { Component, OnInit, signal } from '@angular/core';
import { HealthService } from '../../core/health';

@Component({
  selector: 'app-health-status',
  imports: [],
  templateUrl: './health-status.html',
  styleUrl: './health-status.scss',
})
export class HealthStatus implements OnInit {
  readonly message = signal('Checking API liveness...');
  readonly isHealthy = signal(false);
  readonly hasError = signal(false);

  constructor(private readonly healthService: HealthService) {}

  ngOnInit(): void {
    this.healthService.getLiveness().subscribe({
      next: (response) => {
        this.message.set(`API liveness: ${response}`);
        this.isHealthy.set(true);
        this.hasError.set(false);
      },
      error: () => {
        this.message.set(`Unable to reach API liveness endpoint at ${this.healthService.endpoint}`);
        this.isHealthy.set(false);
        this.hasError.set(true);
      },
    });
  }
}
