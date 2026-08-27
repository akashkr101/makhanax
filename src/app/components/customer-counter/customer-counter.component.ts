import { AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-customer-counter',
  standalone: true,
  templateUrl: './customer-counter.component.html',
  styleUrl: './customer-counter.component.scss'
})
export class CustomerCounterComponent implements AfterViewInit, OnDestroy {
  readonly totalCustomers = input(6034);
  protected readonly displayedCustomers = signal(1);
  protected readonly formattedCustomers = computed(() => {
    const total = this.totalCustomers();
    const digitCount = Math.max(5, String(total).length);
    return String(this.displayedCustomers()).padStart(digitCount, '0');
  });

  private observer?: IntersectionObserver;
  private animationFrame?: number;
  private hasStarted = false;

  constructor(private readonly hostElement: ElementRef<HTMLElement>) {
    effect(() => {
      const total = this.totalCustomers();
      if (this.hasStarted) this.displayedCustomers.set(total);
    });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || this.hasStarted) return;
      this.hasStarted = true;
      this.observer?.disconnect();
      this.animateCount();
    }, { threshold: 0.35 });
    this.observer.observe(this.hostElement.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
  }

  private animateCount(): void {
    const total = this.totalCustomers();
    const startedAt = performance.now();
    const duration = 1600;
    const update = (now: number): void => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.displayedCustomers.set(Math.max(1, Math.round(1 + (total - 1) * easedProgress)));
      if (progress < 1) this.animationFrame = requestAnimationFrame(update);
    };
    this.animationFrame = requestAnimationFrame(update);
  }
}
