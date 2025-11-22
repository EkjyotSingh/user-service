import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize, MaxLength, IsBoolean, IsNumber, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class PollOptionDto {
    @ApiProperty({
        description: 'Option text',
        example: 'Option 1',
    })
    @IsString()
    @MaxLength(500)
    text: string;

    @ApiProperty({
        description: 'Optional image URL for the option',
        example: 'https://example.com/image.jpg',
        required: false,
    })
    @IsString()
    @IsOptional()
    imageUrl?: string;
}

export class CreatePostOrPollDto {
    @ApiProperty({
        description: 'Post content/text. Required for regular posts, optional for polls.',
        example: 'Excited to share my latest project!',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(10000)
    content?: string;

    @ApiProperty({
        description: 'Category for the post/poll',
        example: 'Finance',
        required: false,
    })
    @IsString()
    @IsOptional()
    category?: string;

    // Poll-specific fields
    @ApiProperty({
        description: 'Poll question (required if creating a poll)',
        example: 'What matters most to you when using an app?',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(1000)
    question?: string;

    @ApiProperty({
        description: 'Poll options (required if creating a poll, minimum 2)',
        type: [PollOptionDto],
        required: false,
        example: [
            { text: 'Option 1', imageUrl: 'https://example.com/image1.jpg' },
            { text: 'Option 2', imageUrl: 'https://example.com/image2.jpg' },
        ],
    })
    @IsArray()
    @IsOptional()
    @ArrayMinSize(2, { message: 'At least 2 options are required for polls' })
    @ValidateIf((o) => o.question !== undefined)
    @Type(() => PollOptionDto)
    options?: PollOptionDto[];

    @ApiProperty({
        description: 'Whether users can select multiple options (for polls)',
        example: false,
        default: false,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    multipleSelection?: boolean;

    @ApiProperty({
        description: 'Poll duration in days (1-365, for polls)',
        example: 7,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(1)
    @Max(365)
    @Type(() => Number)
    durationDays?: number;
}

