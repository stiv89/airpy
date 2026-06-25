import { StorageLocation } from '../models/transfer-history.model';

export interface SaveFileResult {
  location: StorageLocation;
  label: string;
}

export async function saveFileToDisk(blob: Blob, fileName: string): Promise<SaveFileResult | null> {
  const picker = (window as Window & { showSaveFilePicker?: Function }).showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: fileName,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return {
        location: 'user_picked',
        label: 'Ubicación que elegiste en tu equipo',
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);

  return {
    location: 'downloads',
    label: 'Carpeta Descargas del sistema',
  };
}
