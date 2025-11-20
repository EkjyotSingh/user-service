import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitAnswerDto {
  @ApiProperty({
    description: 'Question ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({
    description: 'Text answer (for text, textarea questions)',
    required: false,
    example: 'I have a business idea',
  })
  @IsOptional()
  @IsString()
  textAnswer?: string;

  @ApiProperty({
    description: 'Selected option IDs (for single/multiple choice questions)',
    required: false,
    type: [String],
    example: ['option-id-1', 'option-id-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptions?: string[];

  @ApiProperty({
    description: 'File URL (for file upload questions)',
    required: false,
    example: 'https://example.com/resume.pdf',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({
    description: 'File name (for file upload questions)',
    required: false,
    example: 'resume.pdf',
  })
  @IsOptional()
  @IsString()
  fileName?: string;
}
