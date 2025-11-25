import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from "class-validator";
import { PostType } from "../entities/post.entity";

export class CreatePostDto {
    @ApiProperty({
        description: 'Type of the post/poll (text, poll, poll_with_images)',
        example: PostType.TEXT,
        enum: PostType,
        required: true,
    })
    @IsEnum(PostType)
    @IsNotEmpty({ message: 'Type is required' })
    type: PostType;

    @ApiProperty({
        description: 'Post content',
        example: 'Excited to share my latest project!',
        required: false,
    })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiProperty({
        description: 'Category of the post',
        example: 'Finance',
        required: true,
    })
    @IsString()
    @IsNotEmpty({ message: 'Category is required' })
    category: string;

    @ApiProperty({
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'Post images',
        required: false,
    })
    @IsOptional()
    images?: any[];

    @ApiProperty({
        description: 'Poll question',
        example: 'What matters most to you?',
        required: false,
    })
    @IsOptional()
    @IsString()
    question?: string;

    @ApiProperty({
        description: 'Option ID(s) to vote for. Single option ID for single selection polls, array for multiple selection polls',
        example: ['option-1-id'],
        type: [String],
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one option must be selected' })
    @IsString({ each: true })
    @ValidateIf((o) => o.type === PostType.POLL || o.type === PostType.POLL_WITH_IMAGES)
    optionsText: string[];

    @ApiProperty({
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: 'Option images for poll',
        required: false,
    })
    @IsOptional()
    @ValidateIf((o) => o.type === PostType.POLL_WITH_IMAGES)
    optionImages?: any[];

    @ApiProperty({
        description: 'Allow multiple selections',
        example: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    multipleSelection?: boolean;

    @ApiProperty({
        description: 'Poll duration in days',
        example: 7,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    durationDays?: number;
}
