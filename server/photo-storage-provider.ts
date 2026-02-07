import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { db } from './db';
import { systemSettings, tenantStorageSettings } from '../shared/schema';
import { eq } from 'drizzle-orm';

export interface PhotoUploadResult {
  filename: string;
  storagePath: string;
  thumbnailPath: string;
  format: string;
  size: number;
  width?: number;
  height?: number;
  cloudinaryPublicId?: string;
  cloudinaryThumbnailId?: string;
}

export interface PhotoDeleteResult {
  success: boolean;
  deletedFiles: number;
}

export interface StorageProviderConfig {
  provider: 'local' | 'cloudinary';
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryFolder?: string;
}

export interface IPhotoStorageProvider {
  upload(fileBuffer: Buffer, originalName: string, tenantId: string, loanId: string): Promise<PhotoUploadResult>;
  delete(storagePath: string, thumbnailPath?: string): Promise<PhotoDeleteResult>;
  getUrl(storagePath: string, req?: any): string;
}

export class LocalStorageProvider implements IPhotoStorageProvider {
  private getUploadDirectory(): string {
    return path.join(process.cwd(), 'server', 'uploads', 'photos');
  }

  private getAbsolutePath(relativePath: string): string {
    return path.join(process.cwd(), 'server', relativePath);
  }

  async upload(fileBuffer: Buffer, originalName: string, _tenantId: string, _loanId: string): Promise<PhotoUploadResult> {
    const uploadDir = this.getUploadDirectory();
    await fs.mkdir(uploadDir, { recursive: true });

    const metadata = await sharp(fileBuffer).metadata();
    const detectedFormat = metadata.format;

    if (!detectedFormat || !['jpeg', 'png', 'webp'].includes(detectedFormat)) {
      throw new Error(`Unsupported image format: ${detectedFormat}`);
    }

    const uniqueId = uuidv4();
    const timestamp = Date.now();
    const correctExtension = detectedFormat === 'jpeg' ? 'jpg' : detectedFormat;
    const filename = `loan_${timestamp}_${uniqueId}.${correctExtension}`;

    const relativePath = path.join('uploads', 'photos', filename);
    const absolutePath = path.join(uploadDir, filename);
    const thumbnailFilename = `${path.parse(filename).name}_thumb.${correctExtension}`;
    const thumbnailAbsolutePath = path.join(uploadDir, thumbnailFilename);
    const thumbnailRelativePath = path.join('uploads', 'photos', thumbnailFilename);

    console.log(`📸 LOCAL UPLOAD: ${originalName} → ${filename} (${detectedFormat.toUpperCase()})`);

    await this.compressAndSave(fileBuffer, absolutePath, detectedFormat);
    await this.createThumbnail(fileBuffer, thumbnailAbsolutePath, detectedFormat);

    return {
      filename,
      storagePath: relativePath,
      thumbnailPath: thumbnailRelativePath,
      format: detectedFormat,
      size: fileBuffer.length,
      width: metadata.width,
      height: metadata.height,
    };
  }

  async delete(storagePath: string, thumbnailPath?: string): Promise<PhotoDeleteResult> {
    let deletedFiles = 0;

    if (storagePath) {
      const absolutePath = this.getAbsolutePath(storagePath);
      try {
        await fs.access(absolutePath);
        await fs.unlink(absolutePath);
        deletedFiles++;
      } catch {
        deletedFiles++;
      }
    }

    if (thumbnailPath) {
      const thumbnailAbsolutePath = this.getAbsolutePath(thumbnailPath);
      try {
        await fs.access(thumbnailAbsolutePath);
        await fs.unlink(thumbnailAbsolutePath);
      } catch {
        // thumbnail may not exist
      }
    }

    return { success: true, deletedFiles };
  }

  getUrl(storagePath: string, req?: any): string {
    if (req) {
      const baseUrl = req.protocol + '://' + req.get('host');
      const cleanPath = storagePath.replace(/^server[/\\]/, '').replace(/\\/g, '/');
      return `${baseUrl}/${cleanPath}`;
    }
    const cleanPath = storagePath.replace(/^server[/\\]/, '').replace(/\\/g, '/');
    return `/${cleanPath}`;
  }

  private async compressAndSave(inputBuffer: Buffer, outputPath: string, format: string): Promise<void> {
    let sharpInstance = sharp(inputBuffer)
      .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true });

    if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 6 });
    } else if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: 85 });
    } else {
      sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: false, mozjpeg: false });
    }

    await sharpInstance.toFile(outputPath);
  }

  private async createThumbnail(inputBuffer: Buffer, thumbnailPath: string, format: string): Promise<void> {
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
  }
}

export class CloudinaryStorageProvider implements IPhotoStorageProvider {
  private config: StorageProviderConfig;

  constructor(config: StorageProviderConfig) {
    this.config = config;
    this.initCloudinary();
  }

  private initCloudinary(): void {
    cloudinary.config({
      cloud_name: this.config.cloudinaryCloudName,
      api_key: this.config.cloudinaryApiKey,
      api_secret: this.config.cloudinaryApiSecret,
    });
  }

  async upload(fileBuffer: Buffer, originalName: string, tenantId: string, loanId: string): Promise<PhotoUploadResult> {
    const metadata = await sharp(fileBuffer).metadata();
    const detectedFormat = metadata.format;

    if (!detectedFormat || !['jpeg', 'png', 'webp'].includes(detectedFormat)) {
      throw new Error(`Unsupported image format: ${detectedFormat}`);
    }

    const compressedBuffer = await this.compressBuffer(fileBuffer, detectedFormat);

    const folder = this.config.cloudinaryFolder || 'loan_photos';
    const uniqueId = uuidv4().substring(0, 8);
    const publicId = `${folder}/${tenantId}/${loanId}/${uniqueId}`;

    console.log(`📸 CLOUDINARY UPLOAD: ${originalName} → ${publicId}`);

    const mainResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          folder: '',
          resource_type: 'image',
          overwrite: true,
          transformation: [
            { width: 1920, height: 1080, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(compressedBuffer);
    });

    const thumbnailUrl = cloudinary.url(mainResult.public_id, {
      width: 300,
      height: 300,
      crop: 'fill',
      gravity: 'center',
      quality: 'auto:good',
      format: 'auto',
    });

    const correctExtension = detectedFormat === 'jpeg' ? 'jpg' : detectedFormat;
    const filename = `loan_${Date.now()}_${uniqueId}.${correctExtension}`;

    return {
      filename,
      storagePath: mainResult.secure_url,
      thumbnailPath: thumbnailUrl,
      format: detectedFormat,
      size: mainResult.bytes || fileBuffer.length,
      width: mainResult.width || metadata.width,
      height: mainResult.height || metadata.height,
      cloudinaryPublicId: mainResult.public_id,
      cloudinaryThumbnailId: mainResult.public_id,
    };
  }

  async delete(storagePath: string, _thumbnailPath?: string): Promise<PhotoDeleteResult> {
    try {
      const publicId = this.extractPublicId(storagePath);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        console.log(`📸 CLOUDINARY DELETE: ${publicId}`);
        return { success: true, deletedFiles: 1 };
      }
      return { success: true, deletedFiles: 0 };
    } catch (error) {
      console.warn(`📸 CLOUDINARY DELETE WARNING:`, error);
      return { success: false, deletedFiles: 0 };
    }
  }

  getUrl(storagePath: string, _req?: any): string {
    return storagePath;
  }

  private extractPublicId(url: string): string | null {
    try {
      if (url.includes('cloudinary.com')) {
        const parts = url.split('/upload/');
        if (parts.length > 1) {
          let publicIdWithExt = parts[1];
          publicIdWithExt = publicIdWithExt.replace(/^v\d+\//, '');
          const lastDot = publicIdWithExt.lastIndexOf('.');
          if (lastDot > -1) {
            return publicIdWithExt.substring(0, lastDot);
          }
          return publicIdWithExt;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async compressBuffer(inputBuffer: Buffer, format: string): Promise<Buffer> {
    let sharpInstance = sharp(inputBuffer)
      .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true });

    if (format === 'png') {
      sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 6 });
    } else if (format === 'webp') {
      sharpInstance = sharpInstance.webp({ quality: 85 });
    } else {
      sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: false, mozjpeg: false });
    }

    return sharpInstance.toBuffer();
  }

  static async testConnection(config: StorageProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
      cloudinary.config({
        cloud_name: config.cloudinaryCloudName,
        api_key: config.cloudinaryApiKey,
        api_secret: config.cloudinaryApiSecret,
      });

      const result = await cloudinary.api.ping();
      if (result.status === 'ok') {
        return { success: true, message: 'Cloudinary connection successful!' };
      }
      return { success: false, message: 'Cloudinary ping failed' };
    } catch (error: any) {
      return { success: false, message: `Connection failed: ${error.message || 'Unknown error'}` };
    }
  }
}

class NoOpDeleteProvider implements IPhotoStorageProvider {
  async upload(): Promise<PhotoUploadResult> {
    throw new Error('NoOpDeleteProvider does not support uploads');
  }
  async delete(storagePath: string): Promise<PhotoDeleteResult> {
    console.warn(`📸 SKIPPED DELETE: Cannot delete Cloudinary photo "${storagePath}" - no valid credentials configured. Photo will remain on Cloudinary until credentials are restored.`);
    return { success: true, deletedFiles: 0 };
  }
  getUrl(storagePath: string): string {
    return storagePath;
  }
}

export class PhotoProviderResolver {
  static async getProviderForPhoto(photo: { storageProvider?: string; storagePath?: string; cloudinaryPublicId?: string }, tenantId: string): Promise<IPhotoStorageProvider> {
    const isCloudinaryPhoto = photo.storageProvider === 'cloudinary' ||
      (photo.storagePath && photo.storagePath.includes('cloudinary.com'));

    if (isCloudinaryPhoto) {
      const config = await PhotoStorageFactory.getStorageConfig(tenantId);
      if (config.cloudinaryApiKey && config.cloudinaryApiSecret && config.cloudinaryCloudName) {
        return new CloudinaryStorageProvider(config);
      }
      console.warn(`📸 PROVIDER MISMATCH: Photo stored on Cloudinary but tenant has no valid Cloudinary credentials. Skipping cloud deletion.`);
      return new NoOpDeleteProvider();
    }

    return new LocalStorageProvider();
  }
}

const providerCache: Map<string, { provider: IPhotoStorageProvider; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export class PhotoStorageFactory {
  static async getProvider(tenantId: string): Promise<IPhotoStorageProvider> {
    const cached = providerCache.get(tenantId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.provider;
    }

    const config = await PhotoStorageFactory.getStorageConfig(tenantId);
    let provider: IPhotoStorageProvider;

    if (config.provider === 'cloudinary' && config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret) {
      provider = new CloudinaryStorageProvider(config);
      console.log(`📸 PROVIDER: Cloudinary selected for tenant ${tenantId}`);
    } else {
      provider = new LocalStorageProvider();
      console.log(`📸 PROVIDER: Local storage selected for tenant ${tenantId}`);
    }

    providerCache.set(tenantId, { provider, timestamp: Date.now() });
    return provider;
  }

  static async getStorageConfig(tenantId: string): Promise<StorageProviderConfig> {
    try {
      const [tenantConfig] = await db.select()
        .from(tenantStorageSettings)
        .where(eq(tenantStorageSettings.tenantId, tenantId));

      if (tenantConfig && tenantConfig.isConfigured) {
        return {
          provider: tenantConfig.storageProvider as 'local' | 'cloudinary',
          cloudinaryCloudName: tenantConfig.cloudinaryCloudName || undefined,
          cloudinaryApiKey: tenantConfig.cloudinaryApiKey || undefined,
          cloudinaryApiSecret: tenantConfig.cloudinaryApiSecret || undefined,
          cloudinaryFolder: tenantConfig.cloudinaryFolder || undefined,
        };
      }

      const [defaultProvider] = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.settingKey, 'default_storage_provider'));

      if (defaultProvider) {
        const defaultConfig = JSON.parse(defaultProvider.settingValue);
        return {
          provider: defaultConfig.provider || 'local',
          cloudinaryCloudName: defaultConfig.cloudinaryCloudName,
          cloudinaryApiKey: defaultConfig.cloudinaryApiKey,
          cloudinaryApiSecret: defaultConfig.cloudinaryApiSecret,
          cloudinaryFolder: defaultConfig.cloudinaryFolder,
        };
      }

      return { provider: 'local' };
    } catch (error) {
      console.warn('📸 CONFIG: Failed to load storage config, using local:', error);
      return { provider: 'local' };
    }
  }

  static clearCache(tenantId?: string): void {
    if (tenantId) {
      providerCache.delete(tenantId);
    } else {
      providerCache.clear();
    }
  }
}
