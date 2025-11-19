import { ApiProperty } from '@nestjs/swagger';
import { QuestionType, DisplayStyle } from '../entities/question.entity';

export class QuestionOptionResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'I have a business idea' })
  label: string;

  @ApiProperty({ example: 'i_have_a_business_idea', required: false })
  value?: string;

  @ApiProperty({ example: 1 })
  displayOrder: number;
}

export class QuestionResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'What brings you here?' })
  text: string;

  @ApiProperty({ example: 'Select all that apply', required: false })
  subtitle?: string;

  @ApiProperty({
    enum: QuestionType,
    example: QuestionType.SINGLE_CHOICE,
    description: 'Question type (single_choice, multiple_choice, text, textarea, file_upload)',
  })
  type: QuestionType;

  @ApiProperty({
    enum: DisplayStyle,
    example: DisplayStyle.RADIO,
    required: false,
    description:
      'Display style determines the exact UI component: radio = radio buttons, checkbox = checkboxes, tab = tabs/tags, text_input = text input, textarea = textarea, file_upload = file upload',
  })
  displayStyle?: DisplayStyle;

  @ApiProperty({ example: true })
  isRequired: boolean;

  @ApiProperty({ example: 1 })
  stepNumber: number;

  @ApiProperty({ example: 1 })
  displayOrder: number;

  @ApiProperty({ type: [QuestionOptionResponseDto], required: false })
  options?: QuestionOptionResponseDto[];

  @ApiProperty({
    required: false,
    example: { minLength: 10, maxLength: 1000 },
    description: 'Validation rules for text/textarea questions',
  })
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

export class QuestionnaireResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Welcome to Sidekix' })
  title: string;

  @ApiProperty({ example: 'Help us understand your needs', required: false })
  description?: string;

  @ApiProperty({ example: 'user' })
  type: string;

  @ApiProperty({ type: [QuestionResponseDto] })
  questions: QuestionResponseDto[];
}
