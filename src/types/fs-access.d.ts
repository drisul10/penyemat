// Parts of the File System Access API that TypeScript's DOM types don't include yet.
// Chromium only; Firefox has no folder picker (autosave there stays in Downloads).

interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker?(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads';
  }): Promise<FileSystemDirectoryHandle>;
}
