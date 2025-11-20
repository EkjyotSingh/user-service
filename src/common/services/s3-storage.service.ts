import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class S3StorageService {
    private readonly s3Client: S3Client;
    private readonly bucketName: string;
    private readonly region: string;
    private readonly cloudFrontUrl?: string;

    constructor(private configService: ConfigService) {
        this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
        this.cloudFrontUrl = this.configService.get<string>('AWS_CLOUDFRONT_URL');

        if (!this.bucketName) {
            throw new Error('AWS_S3_BUCKET_NAME is required');
        }

        this.s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
                secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
            },
        });
    }

    /**
     * Generate unique filename
     */
    generateFileName(originalName: string): string {
        const ext = extname(originalName);
        return `${Date.now()}-${randomUUID()}${ext}`;
    }

    /**
     * Upload file to S3
     */
    async uploadFile(
        file: any,
        folder: string = 'uploads',
    ): Promise<{ key: string; url: string }> {
        const fileName = this.generateFileName(file.originalname);
        const key = folder ? `${folder}/${fileName}` : fileName;

        // Build PutObjectCommand parameters
        const putObjectParams: any = {
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || 'application/octet-stream',
        };

        // Add ACL only if configured (bucket policies might handle this)
        const acl = this.configService.get<string>('AWS_S3_ACL');
        if (acl) {
            putObjectParams.ACL = acl; // e.g., 'public-read', 'private', 'authenticated-read'
        }

        const command = new PutObjectCommand(putObjectParams);
        await this.s3Client.send(command);

        // Return URL - use CloudFront if available, otherwise S3 URL
        const url = this.cloudFrontUrl
            ? `${this.cloudFrontUrl}/${key}`
            : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

        return { key, url };
    }

    /**
     * Delete file from S3
     */
    async deleteFile(key: string): Promise<void> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
        } catch (error) {
            console.warn(`Failed to delete file from S3: ${key}`, error);
        }
    }

    /**
     * Get file URL from S3 key
     */
    getFileUrl(key: string): string {
        if (this.cloudFrontUrl) {
            return `${this.cloudFrontUrl}/${key}`;
        }
        return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    }
}

