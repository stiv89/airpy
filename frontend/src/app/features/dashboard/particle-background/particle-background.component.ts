import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  viewChild,
} from '@angular/core';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

@Component({
  selector: 'app-particle-background',
  standalone: true,
  template: `<canvas #canvas class="block h-full w-full" aria-hidden="true"></canvas>`,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticleBackgroundComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private ctx: CanvasRenderingContext2D | null = null;
  private particles: Particle[] = [];
  private frameId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private running = false;
  private reducedMotion = false;

  private readonly colors = [
    'rgba(0, 113, 227, 0.35)',
    'rgba(90, 200, 250, 0.28)',
    'rgba(120, 140, 255, 0.25)',
    'rgba(52, 199, 89, 0.18)',
    'rgba(175, 130, 255, 0.22)',
  ];

  ngAfterViewInit(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = this.canvasRef().nativeElement;
    this.ctx = canvas.getContext('2d');

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.resize();
    if (!this.reducedMotion) {
      this.start();
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.stop();
    } else if (!this.reducedMotion) {
      this.start();
    }
  };

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    this.width = parent.clientWidth;
    this.height = parent.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(this.width * this.dpr);
    canvas.height = Math.floor(this.height * this.dpr);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;

    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.initParticles();
  }

  private initParticles(): void {
    const area = this.width * this.height;
    const count = Math.min(55, Math.max(22, Math.floor(area / 18000)));
    this.particles = Array.from({ length: count }, () => this.createParticle(true));
  }

  private createParticle(randomPosition: boolean): Particle {
    const radius = 2 + Math.random() * 4;
    const speed = 0.15 + Math.random() * 0.35;

    return {
      x: randomPosition ? Math.random() * this.width : this.width / 2,
      y: randomPosition ? Math.random() * this.height : this.height / 2,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      radius,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
    };
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  private stop(): void {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private tick = (): void => {
    if (!this.running || !this.ctx) return;

    this.update();
    this.draw();
    this.frameId = requestAnimationFrame(this.tick);
  };

  private update(): void {
    const damping = 0.999;
    const restitution = 0.82;

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= damping;
      p.vy *= damping;

      if (p.x - p.radius < 0) {
        p.x = p.radius;
        p.vx = Math.abs(p.vx) * restitution;
      } else if (p.x + p.radius > this.width) {
        p.x = this.width - p.radius;
        p.vx = -Math.abs(p.vx) * restitution;
      }

      if (p.y - p.radius < 0) {
        p.y = p.radius;
        p.vy = Math.abs(p.vy) * restitution;
      } else if (p.y + p.radius > this.height) {
        p.y = this.height - p.radius;
        p.vy = -Math.abs(p.vy) * restitution;
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        this.resolveCollision(this.particles[i], this.particles[j], restitution);
      }
    }
  }

  private resolveCollision(a: Particle, b: Particle, restitution: number): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = a.radius + b.radius;

    if (dist === 0 || dist >= minDist) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    a.x -= (nx * overlap) / 2;
    a.y -= (ny * overlap) / 2;
    b.x += (nx * overlap) / 2;
    b.y += (ny * overlap) / 2;

    const dvx = a.vx - b.vx;
    const dvy = a.vy - b.vy;
    const impact = dvx * nx + dvy * ny;

    if (impact <= 0) return;

    const impulse = impact * restitution;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        this.drawLink(ctx, this.particles[i], this.particles[j]);
      }
    }

    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
  }

  private drawLink(ctx: CanvasRenderingContext2D, a: Particle, b: Particle): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = 120;

    if (dist > maxDist) return;

    const alpha = (1 - dist / maxDist) * 0.12;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(0, 113, 227, ${alpha})`;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}
