import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class VotePollDto {
    @ApiProperty({
        description: 'Post ID (poll post)',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    pollId: string; // This is actually a postId for a poll post

    @ApiProperty({
        description: 'Option ID(s) to vote for. Single option ID for single selection polls, array for multiple selection polls',
        example: ['option-1-id'],
        type: [String],
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one option must be selected' })
    @IsString({ each: true })
    optionIds: string[];
}

