import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebRtcService } from '../../../core/services/webrtc.service';
import { getFileExtension } from '../../../core/utils/file-preview.util';

@Component({
  selector: 'app-file-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-preview-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreviewModalComponent {
  private readonly webrtc = inject(WebRtcService);

  readonly preview = this.webrtc.receivedFilePreview;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.preview()) {
      this.dismiss();
    }
  }

  dismiss(): void {
    this.webrtc.dismissReceivedPreview();
  }

  download(): void {
    void this.webrtc.downloadReceivedFile();
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
  }

  fileExtension(fileName: string): string {
    return getFileExtension(fileName);
  }
}
