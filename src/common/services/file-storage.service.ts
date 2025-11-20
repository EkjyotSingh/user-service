import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Injectable()
export class FileStorageService {
    private readonly uploadDir: string;

    constructor(private configService: ConfigService) {
        // Use config or default to 'uploads' directory
        this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 'uploads';
        this.ensureUploadDirectory();
    }

    private async ensureUploadDirectory() {
        try {
            await fs.access(this.uploadDir);
        } catch {
            await fs.mkdir(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Get multer storage configuration
     */
    getStorageConfig() {
        return diskStorage({
            destination: async (req, file, cb) => {
                // Ensure directory exists
                await this.ensureUploadDirectory();
                cb(null, this.uploadDir);
            },
            filename: (req, file, cb) => {
                // Generate unique filename: timestamp-uuid.extension
                const uniqueName = `${Date.now()}-${randomUUID()}${extname(file.originalname)}`;
                cb(null, uniqueName);
            },
        });
    }

    /**
     * Validate file type
     */
    fileFilter(allowedMimeTypes?: string[]) {
        return (req: any, file: any, cb: any) => {
            if (allowedMimeTypes && allowedMimeTypes.length > 0) {
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    cb(
                        new BadRequestException(
                            `File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
                        ),
                        false,
                    );
                    return;
                }
            }
            cb(null, true);
        };
    }

    /**
     * Get file URL (relative or absolute based on config)
     */
    getFileUrl(filename: string): string {
        const baseUrl = this.configService.get<string>('FILE_BASE_URL') || '/uploads';
        return `${baseUrl}/${filename}`;
    }

    /**
     * Delete file from storage
     */
    async deleteFile(filename: string): Promise<void> {
        try {
            const filePath = path.join(this.uploadDir, filename);
            await fs.unlink(filePath);
        } catch (error) {
            // File might not exist, ignore error
            console.warn(`Failed to delete file: ${filename}`, error);
        }
    }

    /**
     * Get file path
     */
    getFilePath(filename: string): string {
        return path.join(this.uploadDir, filename);
    }
}

