import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { loanPhotos, loans } from '../shared/schema';
import type { InsertLoanPhoto } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { PhotoStorageFactory, PhotoProviderResolver, type IPhotoStorageProvider } from './photo-storage-provider';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('केवळ JPG, PNG, WebP फाइल्स allowed आहेत'), false);
  }
};

export const photoUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 2
  }
});

export class PhotoService {
  
  static getUploadDirectory(): string {
    return path.join(process.cwd(), 'server', 'uploads', 'photos');
  }
  
  static getAbsolutePath(relativePath: string): string {
    return path.join(process.cwd(), 'server', relativePath);
  }
  
  static getRelativePath(absolutePath: string): string {
    const serverDir = path.join(process.cwd(), 'server');
    return path.relative(serverDir, absolutePath);
  }

  static async processAndSavePhoto(fileBuffer: Buffer, originalName: string, tenantId: string, loanId: string): Promise<{
    filename: string;
    storagePath: string;
    thumbnailPath: string;
    format: string;
    size: number;
    width?: number;
    height?: number;
    storageProvider: string;
    cloudinaryPublicId?: string;
  }> {
    try {
      const provider = await PhotoStorageFactory.getProvider(tenantId);
      const result = await provider.upload(fileBuffer, originalName, tenantId, loanId);
      
      const config = await PhotoStorageFactory.getStorageConfig(tenantId);
      
      console.log(`📸 PROCESSED [${config.provider.toUpperCase()}]: ${originalName} → ${result.filename}`);
      
      return {
        filename: result.filename,
        storagePath: result.storagePath,
        thumbnailPath: result.thumbnailPath,
        format: result.format,
        size: result.size,
        width: result.width,
        height: result.height,
        storageProvider: config.provider,
        cloudinaryPublicId: result.cloudinaryPublicId,
      };
    } catch (error) {
      console.error('Photo processing error:', error);
      throw new Error(`फोटो प्रक्रिया करताना त्रुटी: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async getImageMetadata(imagePath: string): Promise<{
    format?: string;
    width?: number;
    height?: number;
    size?: number;
  }> {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: metadata.size
      };
    } catch (error) {
      console.error('Metadata read error:', error);
      throw new Error('फोटो metadata वाचताना त्रुटी झाली');
    }
  }

  static async validatePhotoSystem(db: any, tenantId: string): Promise<{
    totalPhotos: number;
    activePhotos: number;
    deletedPhotos: number;
    orphanedPhotos: number;
    missingFiles: number;
    validationPassed: boolean;
  }> {
    try {
      const allPhotos = await db.select()
        .from(loanPhotos)
        .where(eq(loanPhotos.tenantId, tenantId));

      const activePhotos = allPhotos.filter((p: any) => p.isActive);
      const deletedPhotos = allPhotos.filter((p: any) => !p.isActive);

      const validLoans = await db.select({ id: loans.id })
        .from(loans)
        .where(eq(loans.tenantId, tenantId));
      
      const validLoanIds = new Set(validLoans.map((l: any) => l.id));
      const orphanedPhotos = allPhotos.filter((p: any) => !validLoanIds.has(p.loanId));

      let missingFiles = 0;
      for (const photo of activePhotos) {
        try {
          if (photo.storageProvider === 'cloudinary' || (photo.storagePath && photo.storagePath.includes('cloudinary.com'))) {
            continue;
          }
          if (photo.storagePath) {
            const absolutePath = PhotoService.getAbsolutePath(photo.storagePath);
            await fs.access(absolutePath);
          }
        } catch {
          missingFiles++;
          console.warn(`📸 MISSING FILE: ${photo.filename} for loan ${photo.loanId}`);
        }
      }

      const validationResult = {
        totalPhotos: allPhotos.length,
        activePhotos: activePhotos.length,
        deletedPhotos: deletedPhotos.length,
        orphanedPhotos: orphanedPhotos.length,
        missingFiles,
        validationPassed: orphanedPhotos.length === 0 && missingFiles === 0
      };

      console.log(`📸 PHOTO SYSTEM VALIDATION:`, validationResult);
      return validationResult;
    } catch (error) {
      console.error('Photo validation error:', error);
      return {
        totalPhotos: 0,
        activePhotos: 0,
        deletedPhotos: 0,
        orphanedPhotos: 0,
        missingFiles: 0,
        validationPassed: false
      };
    }
  }

  static async compressImageFromBuffer(inputBuffer: Buffer, outputPath: string, format: string): Promise<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }> {
    try {
      const originalSize = inputBuffer.length;

      let sharpInstance = sharp(inputBuffer)
        .resize({
          width: 1920,
          height: 1080,
          fit: 'inside',
          withoutEnlargement: true
        });

      if (format === 'png') {
        sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 6 });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality: 85 });
      } else {
        sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: false, mozjpeg: false });
      }

      await sharpInstance.toFile(outputPath);

      const compressedStats = await fs.stat(outputPath);
      const compressedSize = compressedStats.size;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      console.log(`📸 COMPRESSION: ${format.toUpperCase()} ${originalSize}→${compressedSize} bytes (${compressionRatio.toFixed(1)}% saved)`);

      return { originalSize, compressedSize, compressionRatio };
    } catch (error) {
      console.error('Image compression error:', error);
      throw new Error('फोटो कॉम्प्रेस करताना त्रुटी झाली');
    }
  }

  static async compressImage(inputPath: string, outputPath: string): Promise<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  }> {
    const buffer = await fs.readFile(inputPath);
    const metadata = await sharp(buffer).metadata();
    const format = metadata.format || 'jpeg';
    return PhotoService.compressImageFromBuffer(buffer, outputPath, format);
  }

  static async createThumbnailFromBuffer(inputBuffer: Buffer, thumbnailPath: string, format: string): Promise<void> {
    try {
      let sharpInstance = sharp(inputBuffer)
        .resize(300, 300, { fit: 'cover', position: 'center' });

      if (format === 'png') {
        sharpInstance = sharpInstance.png({ quality: 85 });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality: 80 });
      } else {
        sharpInstance = sharpInstance.jpeg({ quality: 80, progressive: false });
      }

      await sharpInstance.toFile(thumbnailPath);
      console.log(`📸 THUMBNAIL: Created ${format.toUpperCase()} thumbnail`);
    } catch (error) {
      console.error('Thumbnail creation error:', error);
      throw new Error('Thumbnail तयार करताना त्रुटी झाली');
    }
  }

  static async createThumbnail(inputPath: string, thumbnailPath: string): Promise<void> {
    const buffer = await fs.readFile(inputPath);
    const metadata = await sharp(buffer).metadata();
    const format = metadata.format || 'jpeg';
    return PhotoService.createThumbnailFromBuffer(buffer, thumbnailPath, format);
  }

  static async savePhotoMetadata(db: any, photoData: InsertLoanPhoto): Promise<string> {
    try {
      const [savedPhoto] = await db.insert(loanPhotos).values(photoData).returning({ id: loanPhotos.id });
      return savedPhoto.id;
    } catch (error) {
      console.error('Photo metadata save error:', error);
      throw new Error('फोटो डेटा save करताना त्रुटी झाली');
    }
  }

  static async getPhotosForLoan(db: any, loanId: string, tenantId: string): Promise<any[]> {
    try {
      const photos = await db.select().from(loanPhotos).where(
        and(
          eq(loanPhotos.loanId, loanId),
          eq(loanPhotos.tenantId, tenantId),
          eq(loanPhotos.isActive, true)
        )
      );
      return photos;
    } catch (error) {
      console.error('Fetch photos error:', error);
      throw new Error('फोटो fetch करताना त्रुटी झाली');
    }
  }

  static async deletePhotosForLoan(db: any, loanId: string, tenantId: string): Promise<{
    deletedFiles: number;
    deletedRecords: number;
  }> {
    try {
      console.log(`📸 AUTO-DELETE: Starting photo deletion for loan ${loanId}`);
      
      const photos = await PhotoService.getPhotosForLoan(db, loanId, tenantId);
      
      if (photos.length === 0) {
        console.log(`📸 AUTO-DELETE: No photos found for loan ${loanId} - skipping`);
        return { deletedFiles: 0, deletedRecords: 0 };
      }

      console.log(`📸 AUTO-DELETE: Found ${photos.length} photos to delete for loan ${loanId}`);
      
      let deletedFiles = 0;
      
      for (const photo of photos) {
        try {
          const photoProvider = await PhotoProviderResolver.getProviderForPhoto(photo, tenantId);
          const result = await photoProvider.delete(photo.storagePath, photo.thumbnailPath);
          deletedFiles += result.deletedFiles;
          console.log(`📸 DELETED [${photo.storageProvider || 'local'}]: ${photo.filename}`);
        } catch (fileError) {
          console.warn(`📸 FILE DELETION WARNING: ${photo.filename}:`, fileError);
        }
      }

      const deletedRecords = await db.update(loanPhotos)
        .set({ 
          isActive: false, 
          updatedAt: new Date(),
          deletedReason: 'AUTO_DELETE_ON_CLOSURE'
        })
        .where(
          and(
            eq(loanPhotos.loanId, loanId),
            eq(loanPhotos.tenantId, tenantId),
            eq(loanPhotos.isActive, true)
          )
        );

      console.log(`📸 AUTO-DELETE COMPLETE: ${deletedFiles} files + ${deletedRecords.length || 0} records deleted for loan ${loanId}`);

      return {
        deletedFiles,
        deletedRecords: deletedRecords.length || 0
      };
    } catch (error) {
      console.error(`📸 CRITICAL ERROR: Photo deletion failed for loan ${loanId}:`, error);
      return {
        deletedFiles: 0,
        deletedRecords: 0
      };
    }
  }

  static async deleteSinglePhoto(db: any, photo: any, tenantId: string): Promise<{ success: boolean }> {
    try {
      const photoProvider = await PhotoProviderResolver.getProviderForPhoto(photo, tenantId);
      await photoProvider.delete(photo.storagePath, photo.thumbnailPath);
      console.log(`📸 INDIVIDUAL DELETE [${photo.storageProvider || 'local'}]: ${photo.filename}`);

      await db.update(loanPhotos)
        .set({ 
          isActive: false, 
          updatedAt: new Date(),
          deletedReason: 'USER_MANUAL_DELETE'
        })
        .where(
          and(
            eq(loanPhotos.id, photo.id),
            eq(loanPhotos.tenantId, tenantId)
          )
        );

      console.log(`📸 INDIVIDUAL DELETE: Photo ${photo.filename} deleted successfully`);
      return { success: true };
    } catch (error) {
      console.error('Individual photo deletion error:', error);
      return { success: false };
    }
  }

  static getHostingCompatiblePath(filename: string): string {
    return path.join('uploads', 'photos', filename).replace(/\\/g, '/');
  }

  static getPhotoUrl(req: any, photo: any): string {
    const storagePath = typeof photo === 'string' ? photo : photo.storagePath;
    const isCloudinary = (typeof photo !== 'string' && photo.storageProvider === 'cloudinary') ||
      (storagePath && storagePath.includes('cloudinary.com'));

    if (isCloudinary) {
      return storagePath;
    }

    const baseUrl = req.protocol + '://' + req.get('host');
    const cleanPath = storagePath.replace(/^server[/\\]/, '').replace(/\\/g, '/');
    return `${baseUrl}/${cleanPath}`;
  }

  static getPhotoThumbnailUrl(req: any, photo: any): string | null {
    if (!photo.thumbnailPath) return null;
    
    const isCloudinary = photo.storageProvider === 'cloudinary' ||
      (photo.storagePath && photo.storagePath.includes('cloudinary.com'));

    if (isCloudinary) {
      return photo.thumbnailPath;
    }

    const baseUrl = req.protocol + '://' + req.get('host');
    const cleanPath = photo.thumbnailPath.replace(/^server[/\\]/, '').replace(/\\/g, '/');
    return `${baseUrl}/${cleanPath}`;
  }

  static async validatePhotoIntegrity(photoPath: string, expectedFormat: string): Promise<{
    isValid: boolean;
    actualFormat?: string;
    error?: string;
  }> {
    try {
      if (photoPath.includes('cloudinary.com')) {
        return { isValid: true, actualFormat: expectedFormat };
      }

      const absolutePath = PhotoService.getAbsolutePath(photoPath);
      await fs.access(absolutePath);
      
      const metadata = await sharp(absolutePath).metadata();
      const actualFormat = metadata.format;
      
      const isValid = actualFormat === expectedFormat;
      
      if (!isValid) {
        console.warn(`📸 FORMAT MISMATCH: Expected ${expectedFormat}, got ${actualFormat} for ${photoPath}`);
      }
      
      return {
        isValid,
        actualFormat,
        error: isValid ? undefined : `Format mismatch: expected ${expectedFormat}, got ${actualFormat}`
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
