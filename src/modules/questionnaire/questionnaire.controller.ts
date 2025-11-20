import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes, ApiProperty } from '@nestjs/swagger';
import { S3StorageService } from '../../common/services/s3-storage.service';
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
  constructor(
    private readonly questionnaireService: QuestionnaireService,
    private readonly s3StorageService: S3StorageService,
  ) { }

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
    description: 'Get user progress for a specific questionnaire including current step and step-by-step status',
  })
  @ApiResponse({
    status: 200,
    description: 'Progress retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        questionnaireId: { type: 'string' },
        totalQuestions: { type: 'number' },
        answeredQuestions: { type: 'number' },
        progress: { type: 'number', description: 'Progress percentage (0-100)' },
        isCompleted: { type: 'boolean' },
        totalSteps: { type: 'number' },
        currentStep: { type: 'number', description: 'Current step number (first incomplete step)' },
        stepStatus: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepNumber: { type: 'number' },
              isCompleted: { type: 'boolean' },
              totalQuestions: { type: 'number' },
              answeredQuestions: { type: 'number' },
              requiredQuestions: { type: 'number' },
              requiredAnswered: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getProgress(@Param('id') questionnaireId: string, @CurrentUser() user: User) {
    return this.questionnaireService.getQuestionnaireProgress(user.id, questionnaireId);
  }

  @Get('answers/my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get my answers',
    description:
      'Retrieve all answers submitted by the current user. Use ?questionnaireId=xxx to filter by questionnaire.',
  })
  @ApiResponse({
    status: 200,
    description: 'Answers retrieved successfully',
    schema: {
      type: 'array',
      description: 'Array of user answers',
    },
  })
  async getMyAnswers(
    @CurrentUser() user: User,
    @Query('questionnaireId') questionnaireId?: string,
  ) {
    return this.questionnaireService.getUserAnswers(user.id, questionnaireId);
  }

  @Post('answer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit answer',
    description: 'Submit an answer to a question. For file upload questions, include the file in the form-data.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        questionId: { type: 'string', description: 'Question ID' },
        textAnswer: { type: 'string', description: 'Text answer (for text/textarea questions)' },
        selectedOptions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Selected option IDs (for choice questions)',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'File upload (for file upload questions)',
        },
      },
      required: ['questionId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Answer submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid answer or validation failed' })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async submitAnswer(
    @Body() body: any,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(pdf|doc|docx|jpg|jpeg|png|gif|txt|csv|xls|xlsx)/i }),
        ],
      }),
    )
    file?: any,
    @CurrentUser() user?: User,
  ) {
    // Parse selectedOptions if it's a JSON string or comma-separated string (common with multipart/form-data)
    let selectedOptions: string[] | undefined;
    if (body.selectedOptions) {
      if (typeof body.selectedOptions === 'string') {
        try {
          // Try to parse as JSON array first
          selectedOptions = JSON.parse(body.selectedOptions);
          if (!Array.isArray(selectedOptions)) {
            // If parsed but not an array, treat as single value
            selectedOptions = [body.selectedOptions];
          }
        } catch {
          // If JSON parsing fails, check if it's comma-separated
          if (body.selectedOptions.includes(',')) {
            selectedOptions = body.selectedOptions.split(',').map((item: string) => item.trim()).filter(Boolean);
          } else {
            // Single value
            selectedOptions = [body.selectedOptions];
          }
        }
      } else if (Array.isArray(body.selectedOptions)) {
        selectedOptions = body.selectedOptions;
      }
    }

    // Create DTO from body
    const dto: SubmitAnswerDto = {
      questionId: body.questionId,
      textAnswer: body.textAnswer,
      selectedOptions,
    };

    // If file is uploaded, upload to S3 and set fileUrl and fileName
    if (file) {
      const { url, key } = await this.s3StorageService.uploadFile(file, 'questionnaire-uploads');
      dto.fileUrl = url;
      dto.fileName = file.originalname;
    }
    return this.questionnaireService.submitAnswer(user!.id, dto);
  }

  @Post('answers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 20, // Max 20 files
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Submit multiple answers',
    description:
      'Submit multiple answers at once. For file upload questions, include files with field names in format "file_<questionId>". For example, for questionId "abc123", use field name "file_abc123".',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        answers: {
          type: 'string',
          description: 'JSON string of answers array. Each answer should have questionId, and textAnswer/selectedOptions based on question type. DO NOT include fileUrl or fileName in answers - use file upload fields instead.',
          example: JSON.stringify([
            { questionId: '123', textAnswer: 'Answer 1' },
            { questionId: '456', selectedOptions: ['opt1'] },
          ]),
        },
        file_123: {
          type: 'string',
          format: 'binary',
          description: 'File upload for questionId "123". Format: file_<questionId> (e.g., file_123, file_456)',
        },
        file_456: {
          type: 'string',
          format: 'binary',
          description: 'File upload for questionId "456". Add file fields for each question that requires file upload using format: file_<questionId>',
        },
      },
      required: ['answers'],
    },
  })
  @ApiResponse({ status: 200, description: 'Answers submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid answers or validation failed' })
  async submitAnswers(
    @Body('answers') answersJson: string,
    @UploadedFiles() files?: any[],
    @CurrentUser() user?: User,
  ) {
    // Parse JSON answers
    let answers: SubmitAnswerDto[];
    try {
      answers = typeof answersJson === 'string' ? JSON.parse(answersJson) : answersJson;
    } catch (error) {
      throw new Error('Invalid JSON format for answers');
    }

    // Match files to answers based on field names
    // Files should be named as "file_<questionId>"
    const filesMap = new Map<string, any>();
    if (files && files.length > 0) {
      files.forEach((file) => {
        // Extract questionId from fieldname (format: "file_<questionId>")
        const match = file.fieldname?.match(/^file_(.+)$/);
        if (match) {
          filesMap.set(match[1], file);
        }
      });
    }

    // Upload files to S3 and attach file URLs to answers
    for (const answer of answers) {
      const file = filesMap.get(answer.questionId);
      if (file) {
        const { url } = await this.s3StorageService.uploadFile(file, 'questionnaire-uploads');
        answer.fileUrl = url;
        answer.fileName = file.originalname;
      }
    }

    return this.questionnaireService.submitAnswers(user!.id, answers);
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
