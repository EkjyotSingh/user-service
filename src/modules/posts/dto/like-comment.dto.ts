import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class LikeCommentDto {
    @ApiProperty({
        description: 'Comment ID to like',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    commentId: string;
}

