import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class ReactToPostDto {
    @ApiProperty({
        description: 'Post ID to react to',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    postId: string;

    @ApiProperty({
        description: 'Reaction emoji ID',
        example: '123e4567-e89b-12d3-a456-426614174001',
    })
    @IsString()
    @IsNotEmpty()
    @IsUUID()
    emojiId: string;
}

