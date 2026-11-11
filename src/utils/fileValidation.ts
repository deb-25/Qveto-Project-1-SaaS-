/**
 * Attachment security validation rules complying with Document 1 §4.6 FR-COL-02 and FR-COL-03.
 * Enforces 10MB file limit and MIME allow-list.
 */

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit (FR-COL-02)

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'text/csv',
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAttachment(file: { name: string; size: number; type: string }): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  // If MIME is provided, verify against allow-list
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type '${file.type}' is disallowed. Allowed formats: images, documents (PDF, DOCX, XLSX), text, CSV, ZIP.`,
    };
  }

  // Reject executable or script extensions
  const blockedExtensions = ['.exe', '.bat', '.sh', '.bin', '.cmd', '.vbs', '.msi', '.dll'];
  const lowerName = file.name.toLowerCase();
  const hasBlockedExt = blockedExtensions.some((ext) => lowerName.endsWith(ext));
  if (hasBlockedExt) {
    return {
      valid: false,
      error: 'Executable and script file uploads are strictly prohibited for security.',
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
