export function createUploadStatusTool(): HTMLDivElement {
  const uploadStatus = document.createElement('div');
  uploadStatus.className = 'mg-editor-upload-status small text-body-secondary align-self-center';
  uploadStatus.setAttribute('role', 'status');
  uploadStatus.setAttribute('aria-live', 'polite');
  uploadStatus.hidden = true;
  return uploadStatus;
}
