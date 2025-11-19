import { QuestionnaireType } from '../entities/questionnaire.entity';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetQuestionnairesDto {
  @ApiProperty({
    description: 'Questionnaire type (user or advisor)',
    enum: QuestionnaireType,
  })
  @IsEnum(QuestionnaireType)
  @IsString()
  @IsNotEmpty()
  type?: QuestionnaireType;
}
