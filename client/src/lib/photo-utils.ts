// Photo utility functions separated from components for better HMR compatibility

export interface UploadedPhoto {
  id: string;
  file: File;
  preview: string;
  compressed?: File;
  originalSize: number;
  compressedSize?: number;
  type: 'camera' | 'gallery';
  isExisting?: boolean; // Flag to distinguish existing vs new photos
}

// Utility function to convert photos to FormData for API upload
export function photosToFormData(photos: UploadedPhoto[], loanId: string): FormData {
  const formData = new FormData();
  
  // Filter only new photos for upload (exclude existing ones)
  const newPhotos = photos.filter(photo => !photo.isExisting);
  
  // Server expects 'photos' field name (as array)
  newPhotos.forEach((photo) => {
    const fileToUpload = photo.compressed || photo.file;
    // Generate proper filename for server
    const filename = `${loanId}_${photo.id}_${photo.type}.jpg`;
    formData.append('photos', fileToUpload, filename);
  });
  
  return formData;
}