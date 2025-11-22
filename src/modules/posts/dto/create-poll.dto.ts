import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize, MaxLength, IsBoolean, IsNumber, Min, Max } from 'class-validator';
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

export class CreatePollDto {
    @ApiProperty({
        description: 'Optional post content/question context',
        example: 'I need suggestion on which logo looks better?',
        required: false,
    })
    @IsString()
    @IsOptional()
    @MaxLength(10000)
    content?: string;

    @ApiProperty({
        description: 'Poll question',
        example: 'What matters most to you when using an app?',
    })
    @IsString()
    @MaxLength(1000)
    question: string;

    @ApiProperty({
        description: 'Poll options (minimum 2)',
        type: [PollOptionDto],
        example: [
            { text: 'Option 1', imageUrl: 'https://example.com/image1.jpg' },
            { text: 'Option 2', imageUrl: 'https://example.com/image2.jpg' },
        ],
    })
    @IsArray()
    @ArrayMinSize(2, { message: 'At least 2 options are required' })
    @Type(() => PollOptionDto)
    options: PollOptionDto[];

    @ApiProperty({
        description: 'Whether users can select multiple options',
        example: false,
        default: false,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    multipleSelection?: boolean;

    @ApiProperty({
        description: 'Poll duration in days (1-365)',
        example: 7,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(1)
    @Max(365)
    @Type(() => Number)
    durationDays?: number;

    @ApiProperty({
        description: 'Category for the poll',
        example: 'Finance',
        required: false,
    })
    @IsString()
    @IsOptional()
    category?: string;
}

