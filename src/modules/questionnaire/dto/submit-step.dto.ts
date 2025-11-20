import { IsString, IsNotEmpty, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SubmitAnswerDto } from './submit-answer.dto';

export class SubmitStepDto {
  @ApiProperty({
    description: 'Questionnaire ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  questionnaireId: string;

  @ApiProperty({
    description: 'Step number',
    example: 1,
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  stepNumber: number;

  @ApiProperty({
    description: 'Answers for all questions in this step',
    type: [SubmitAnswerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}
