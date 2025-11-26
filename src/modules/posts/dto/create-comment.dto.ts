import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
    @ApiProperty({
        description: 'Comment content',
        example: 'This is a great post!',
        maxLength: 5000,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(5000, { message: 'Comment content must not exceed 5000 characters' })
    content: string;

    @ApiProperty({
        description: 'Parent comment ID (for replies). Leave empty for top-level comments.',
        example: '123e4567-e89b-12d3-a456-426614174001',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsUUID()
    parentCommentId?: string;
}

