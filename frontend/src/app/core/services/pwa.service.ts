import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false);
  readonly isInstalled = signal(this.detectStandalone());

  init(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.isInstalled.set(true);
    });
  }

  async install(): Promise<boolean> {
    const prompt = this.deferredPrompt;
    if (!prompt) return false;

    await prompt.prompt();
    const choice = await prompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);

    if (choice.outcome === 'accepted') {
      this.isInstalled.set(true);
      return true;
    }
    return false;
  }

  dismissInstallOffer(): void {
    this.canInstall.set(false);
  }

  private detectStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }
}
