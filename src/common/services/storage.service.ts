import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';
import { FileStorageService } from './file-storage.service';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface UploadResult {
    key: string;
    url: string;
    originalName?: string;
}

@Injectable()
export class StorageService {
    private readonly useS3: boolean;
    private readonly uploadDir: string;

    constructor(
        private configService: ConfigService,
        private s3StorageService: S3StorageService,
        private fileStorageService: FileStorageService,
    ) {
        // Determine storage type based on environment
        // Use S3 if STORAGE_TYPE is 's3' or if AWS_S3_BUCKET_NAME is set
        // Otherwise use local file system
        const storageType = this.configService.get<string>('STORAGE_TYPE');
        const s3BucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
        const nodeEnv = this.configService.get<string>('NODE_ENV');

        // Use S3 if explicitly set to 's3' or if bucket name is configured
        // Default to local in development, S3 in production if bucket is configured
        this.useS3 = storageType === 's3' || (!!s3BucketName && nodeEnv !== 'development');

        this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads';
        this.ensureLocalUploadDirectory();
    }

    private async ensureLocalUploadDirectory() {
        if (!this.useS3) {
            try {
                await fs.access(this.uploadDir);
            } catch {
                await fs.mkdir(this.uploadDir, { recursive: true });
            }
        }
    }

    /**
     * Generate unique filename
     */
    generateFileName(originalName: string): string {
        if (this.useS3) {
            return this.s3StorageService.generateFileName(originalName);
        }
        // Use same logic as S3 for consistency
        const { randomUUID } = require('crypto');
        const { extname } = require('path');
        const ext = extname(originalName);
        return `${Date.now()}-${randomUUID()}${ext}`;
    }

    /**
     * Upload file to storage (S3 or local)
     */
    async uploadFile(file: any, folder: string = 'uploads'): Promise<{ key: string; url: string }> {
        if (this.useS3) {
            return this.s3StorageService.uploadFile(file, folder);
        }

        // Local file system upload
        const fileName = this.generateFileName(file.originalname);
        const folderPath = path.join(this.uploadDir, folder);
        const filePath = path.join(folderPath, fileName);

        // Ensure folder exists
        try {
            await fs.access(folderPath);
        } catch {
            await fs.mkdir(folderPath, { recursive: true });
        }

        // Write file to disk
        await fs.writeFile(filePath, file.buffer);

        // Generate URL
        const baseUrl = this.configService.get<string>('FILE_BASE_URL') || '/uploads';
        const key = folder ? `${folder}/${fileName}` : fileName;
        const url = `${baseUrl}/${key}`;

        return { key, url };
    }

    /**
     * Upload multiple files to storage
     */
    async uploadFiles(
        files: any[],
        folder: string = 'uploads',
    ): Promise<Array<{ key: string; url: string; originalName: string }>> {
        if (this.useS3) {
            return this.s3StorageService.uploadFiles(files, folder);
        }

        // Local file system upload
        const uploadPromises = files.map(async (file) => {
            const { key, url } = await this.uploadFile(file, folder);
            return { key, url, originalName: file.originalname };
        });

        return Promise.all(uploadPromises);
    }

    /**
     * Delete file from storage
     */
    async deleteFile(key: string): Promise<void> {
        if (this.useS3) {
            return this.s3StorageService.deleteFile(key);
        }

        // Local file system delete
        const filePath = path.join(this.uploadDir, key);
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.warn(`Failed to delete file: ${key}`, error);
        }
    }

    /**
     * Get file URL from key
     */
    getFileUrl(key: string): string {
        if (this.useS3) {
            return this.s3StorageService.getFileUrl(key);
        }

        // Local file system URL
        const baseUrl = this.configService.get<string>('FILE_BASE_URL') || '/uploads';
        return `${baseUrl}/${key}`;
    }
}

