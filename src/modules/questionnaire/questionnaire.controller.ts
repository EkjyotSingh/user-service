import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { QuestionnaireService } from './questionnaire.service';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { SubmitStepDto } from './dto/submit-step.dto';
import { QuestionnaireResponseDto } from './dto/question-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { QuestionnaireType } from './entities/questionnaire.entity';
import { GetQuestionnairesDto } from './dto/get-questionnaire.dto';

@ApiTags('Questionnaire')
@Controller('questionnaire')
export class QuestionnaireController {
  constructor(private readonly questionnaireService: QuestionnaireService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all active questionnaires',
    description: 'Retrieve all active questionnaires, optionally filtered by type',
  })
  @ApiResponse({
    status: 200,
    description: 'Questionnaires retrieved successfully',
    type: [QuestionnaireResponseDto],
  })
  async getQuestionnaires(@Query() dto: GetQuestionnairesDto) {
    return this.questionnaireService.getQuestionnaires(dto.type);
  }

  @Get('for-user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get questionnaires for current user',
    description: 'Get questionnaires that should be shown to the user based on their profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Questionnaires retrieved successfully',
    type: [QuestionnaireResponseDto],
  })
  async getQuestionnairesForUser(@CurrentUser() user: User) {
    const questionnaires = await this.questionnaireService.getQuestionnaires();

    // Filter questionnaires based on user profile
    const filtered = questionnaires.filter((q) => {
      // User questionnaire - show to all users who completed profile
      if (q.type === QuestionnaireType.USER && !user.isAdvisor && user.profileCompleted) {
        return true;
      }
      // Advisor questionnaire - show only if user wants to be advisor
      if (q.type === QuestionnaireType.ADVISOR && user.isAdvisor && user.profileCompleted) {
        return true;
      }
      return false;
    });

    return filtered;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get questionnaire by ID',
    description: 'Retrieve a specific questionnaire with all questions and options',
  })
  @ApiResponse({ status: 200, description: 'Questionnaire retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Questionnaire not found' })
  async getQuestionnaireById(@Param('id') id: string) {
    return this.questionnaireService.getQuestionnaireById(id);
  }

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get questionnaire progress',
    description: 'Get user progress for a specific questionnaire',
  })
  @ApiResponse({ status: 200, description: 'Progress retrieved successfully' })
  async getProgress(@Param('id') questionnaireId: string, @CurrentUser() user: User) {
    return this.questionnaireService.getQuestionnaireProgress(user.id, questionnaireId);
  }

  @Get('answers/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get my answers',
    description: 'Retrieve all answers submitted by the current user',
  })
  @ApiResponse({ status: 200, description: 'Answers retrieved successfully' })
  async getMyAnswers(
    @CurrentUser() user: User,
    @Query('questionnaireId') questionnaireId?: string,
  ) {
    return this.questionnaireService.getUserAnswers(user.id, questionnaireId);
  }

  @Post('answer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit answer',
    description: 'Submit an answer to a question',
  })
  @ApiBody({ type: SubmitAnswerDto })
  @ApiResponse({ status: 200, description: 'Answer submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid answer or validation failed' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async submitAnswer(@Body() dto: SubmitAnswerDto, @CurrentUser() user: User) {
    return this.questionnaireService.submitAnswer(user.id, dto);
  }

  @Post('answers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit multiple answers',
    description: 'Submit multiple answers at once',
  })
  @ApiBody({ type: [SubmitAnswerDto] })
  @ApiResponse({ status: 200, description: 'Answers submitted successfully' })
  async submitAnswers(@Body() answers: SubmitAnswerDto[], @CurrentUser() user: User) {
    return this.questionnaireService.submitAnswers(user.id, answers);
  }

  @Post('step')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit step answers',
    description:
      'Submit answers for a specific step. When the last step is submitted and all required questions are answered, the questionnaire will be marked as completed.',
  })
  @ApiBody({ type: SubmitStepDto })
  @ApiResponse({
    status: 200,
    description: 'Step answers submitted successfully',
    schema: {
      type: 'object',
      properties: {
        answers: { type: 'array', description: 'Submitted answers' },
        isLastStep: { type: 'boolean', description: 'Whether this was the last step' },
        questionnaireCompleted: {
          type: 'boolean',
          description: 'Whether the questionnaire is now completed',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid step or questionnaire already completed' })
  @ApiResponse({ status: 404, description: 'Questionnaire or user not found' })
  async submitStep(@Body() dto: SubmitStepDto, @CurrentUser() user: User) {
    return this.questionnaireService.submitStep(user.id, dto);
  }
}
