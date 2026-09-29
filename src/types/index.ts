// Photo from Google Drive
export interface Photo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
  thumbnailUrl: string;
  fullUrl: string;
  webContentLink?: string;
}

// API response for listing photos
export interface PhotoListResponse {
  photos: Photo[];
  nextPageToken?: string;
  total: number;
}

// Upload status for individual file
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  preview: string;
  status: UploadStatus;
  progress: number;
  error?: string;
}

// Upload API response
export interface UploadResponse {
  uploaded: PhotoMetadata[];
  errors: UploadError[];
}

export interface PhotoMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

export interface UploadError {
  fileName: string;
  error: string;
}

// Drive folder
export interface DriveFolder {
  id: string;
  name: string;
  photoCount?: number;
}

// App stats
export interface AppStats {
  totalPhotos: number;
  totalSize: string;
  folderId: string;
  folderName: string;
  lastUpload?: string;
  driveConnected: boolean;
}

// Toast notification
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}
