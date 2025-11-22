import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize, MaxLength } from 'class-validator';

export class CreatePostDto {
    @ApiProperty({
        description: 'Post content/text',
        example: 'Excited to share my latest project!',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(10000)
    content?: string;

    @ApiProperty({
        description: 'Category for the post',
        example: 'Finance',
        required: false,
    })
    @IsString()
    @IsOptional()
    category?: string;
}

