import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Questionnaire, QuestionnaireType } from './entities/questionnaire.entity';
import { Question } from './entities/question.entity';
import { QuestionOption } from './entities/question-option.entity';
import { UserAnswer } from './entities/user-answer.entity';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { SubmitStepDto } from './dto/submit-step.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class QuestionnaireService {
  constructor(
    @InjectRepository(Questionnaire)
    private questionnaireRepo: Repository<Questionnaire>,
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    @InjectRepository(QuestionOption)
    private optionRepo: Repository<QuestionOption>,
    @InjectRepository(UserAnswer)
    private answerRepo: Repository<UserAnswer>,
    private usersService: UsersService,
  ) {}

  async getQuestionnaires(type?: QuestionnaireType) {
    const query = this.questionnaireRepo
      .createQueryBuilder('questionnaire')
      .leftJoinAndSelect('questionnaire.questions', 'question')
      .leftJoinAndSelect('question.options', 'option')
      .where('questionnaire.isActive = :isActive', { isActive: true })
      .orderBy('questionnaire.displayOrder', 'ASC')
      .addOrderBy('question.stepNumber', 'ASC')
      .addOrderBy('question.displayOrder', 'ASC')
      .addOrderBy('option.displayOrder', 'ASC');

    if (type) {
      query.andWhere('questionnaire.type = :type', { type });
    }

    return query.getMany();
  }

  async getQuestionnaireById(id: string) {
    const questionnaire = await this.questionnaireRepo.findOne({
      where: { id, isActive: true },
      relations: ['questions', 'questions.options'],
    });

    if (!questionnaire) {
      throw new NotFoundException('Questionnaire not found');
    }

    // Sort questions by step and display order
    questionnaire.questions.sort((a, b) => {
      if (a.stepNumber !== b.stepNumber) {
        return a.stepNumber - b.stepNumber;
      }
      return a.displayOrder - b.displayOrder;
    });

    questionnaire.questions.forEach((q) => {
      q.options.sort((a, b) => a.displayOrder - b.displayOrder);
    });

    return questionnaire;
  }

  async getUserAnswers(userId: string, questionnaireId?: string) {
    const query = this.answerRepo
      .createQueryBuilder('answer')
      .leftJoinAndSelect('answer.question', 'question')
      .leftJoinAndSelect('question.questionnaire', 'questionnaire')
      .leftJoinAndSelect('question.options', 'options')
      .where('answer.userId = :userId', { userId });

    if (questionnaireId) {
      query.andWhere('questionnaire.id = :questionnaireId', { questionnaireId });
    }

    return query.getMany();
  }

  async submitAnswer(userId: string, dto: SubmitAnswerDto) {
    const question = await this.questionRepo.findOne({
      where: { id: dto.questionId },
      relations: ['options', 'questionnaire'],
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (!question.questionnaire.isActive) {
      throw new BadRequestException('Questionnaire is not active');
    }

    // Check if user has completed this questionnaire
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.questionnaireCompleted) {
      throw new BadRequestException('Questionnaire already completed. Answers cannot be updated.');
    }

    // Validate answer based on question type
    this.validateAnswer(question, dto);

    // Check if answer already exists
    let answer = await this.answerRepo.findOne({
      where: { userId, questionId: dto.questionId },
    });

    if (answer) {
      // Update existing answer
      answer.textAnswer = dto.textAnswer;
      answer.selectedOptions = dto.selectedOptions;
      answer.fileUrl = dto.fileUrl;
      answer.fileName = dto.fileName;
    } else {
      // Create new answer
      answer = this.answerRepo.create({
        userId,
        questionId: dto.questionId,
        textAnswer: dto.textAnswer,
        selectedOptions: dto.selectedOptions,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
      });
    }

    return this.answerRepo.save(answer);
  }

  async submitStep(userId: string, dto: SubmitStepDto) {
    // Get questionnaire with all questions
    const questionnaire = await this.getQuestionnaireById(dto.questionnaireId);

    // Check if user has completed this questionnaire
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.questionnaireCompleted) {
      throw new BadRequestException('Questionnaire already completed. Answers cannot be updated.');
    }

    // Get all questions for this step
    const stepQuestions = questionnaire.questions.filter((q) => q.stepNumber === dto.stepNumber);

    if (stepQuestions.length === 0) {
      throw new BadRequestException(`Step ${dto.stepNumber} not found in this questionnaire`);
    }

    // Validate that all answers belong to this step
    const stepQuestionIds = stepQuestions.map((q) => q.id);
    for (const answer of dto.answers) {
      if (!stepQuestionIds.includes(answer.questionId)) {
        throw new BadRequestException(
          `Question ${answer.questionId} does not belong to step ${dto.stepNumber}`,
        );
      }
    }

    // Submit all answers for this step
    const results: UserAnswer[] = [];
    for (const answerDto of dto.answers) {
      const result = await this.submitAnswer(userId, answerDto);
      results.push(result);
    }

    // Check if this is the last step
    const maxStepNumber = Math.max(...questionnaire.questions.map((q) => q.stepNumber));
    const isLastStep = dto.stepNumber === maxStepNumber;

    let questionnaireCompleted = false;

    // Check if all required questions are answered
    if (isLastStep) {
      const allAnswers = await this.getUserAnswers(userId, dto.questionnaireId);
      const answeredQuestionIds = new Set(allAnswers.map((a) => a.questionId));
      const requiredQuestions = questionnaire.questions.filter((q) => q.isRequired);

      const allRequiredAnswered = requiredQuestions.every((q) => answeredQuestionIds.has(q.id));

      if (allRequiredAnswered) {
        // Mark questionnaire as completed
        await this.usersService.update(userId, {
          questionnaireCompleted: true,
        } as any);
        questionnaireCompleted = true;
      }
    }

    return {
      answers: results,
      isLastStep,
      questionnaireCompleted,
    };
  }

  async submitAnswers(userId: string, answers: SubmitAnswerDto[]) {
    const results: UserAnswer[] = [];
    for (const answerDto of answers) {
      const result = await this.submitAnswer(userId, answerDto);
      results.push(result);
    }
    return results;
  }

  async getQuestionnaireProgress(userId: string, questionnaireId: string) {
    const questionnaire = await this.getQuestionnaireById(questionnaireId);
    const answers = await this.getUserAnswers(userId, questionnaireId);

    const totalQuestions = questionnaire.questions.length;
    const answeredQuestions = answers.length;
    const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

    return {
      questionnaireId,
      totalQuestions,
      answeredQuestions,
      progress: Math.round(progress),
      isCompleted: answeredQuestions === totalQuestions,
    };
  }

  async checkAllQuestionnairesCompleted(userId: string): Promise<boolean> {
    const questionnaires = await this.getQuestionnaires();
    const allAnswers = await this.getUserAnswers(userId);

    // Group answers by questionnaire
    const answersByQuestionnaire = new Map<string, Set<string>>();
    allAnswers.forEach((answer) => {
      const qId = answer.question.questionnaire.id;
      if (!answersByQuestionnaire.has(qId)) {
        answersByQuestionnaire.set(qId, new Set());
      }
      answersByQuestionnaire.get(qId)!.add(answer.questionId);
    });

    // Check if all required questions are answered for each questionnaire
    for (const questionnaire of questionnaires) {
      const answeredQuestionIds = answersByQuestionnaire.get(questionnaire.id) || new Set();
      const requiredQuestions = questionnaire.questions.filter((q) => q.isRequired);

      for (const question of requiredQuestions) {
        if (!answeredQuestionIds.has(question.id)) {
          return false;
        }
      }
    }

    return true;
  }

  private validateAnswer(question: Question, dto: SubmitAnswerDto) {
    if (question.isRequired) {
      if (question.type === 'text' || question.type === 'textarea') {
        if (!dto.textAnswer || dto.textAnswer.trim().length === 0) {
          throw new BadRequestException(`Answer is required for question: ${question.text}`);
        }
      } else if (question.type === 'single_choice' || question.type === 'multiple_choice') {
        if (!dto.selectedOptions || dto.selectedOptions.length === 0) {
          throw new BadRequestException(`Please select at least one option for: ${question.text}`);
        }
        if (question.type === 'single_choice' && dto.selectedOptions.length > 1) {
          throw new BadRequestException(`Only one option can be selected for: ${question.text}`);
        }
        // Validate option IDs exist
        const validOptionIds = question.options.map((opt) => opt.id);
        const invalidOptions = dto.selectedOptions.filter((id) => !validOptionIds.includes(id));
        if (invalidOptions.length > 0) {
          throw new BadRequestException(`Invalid option IDs: ${invalidOptions.join(', ')}`);
        }
      } else if (question.type === 'file_upload') {
        if (!dto.fileUrl) {
          throw new BadRequestException(`File upload is required for: ${question.text}`);
        }
      }
    }

    // Validate text length if validation rules exist
    if (dto.textAnswer && question.validation) {
      if (question.validation.minLength && dto.textAnswer.length < question.validation.minLength) {
        throw new BadRequestException(
          `Answer must be at least ${question.validation.minLength} characters`,
        );
      }
      if (question.validation.maxLength && dto.textAnswer.length > question.validation.maxLength) {
        throw new BadRequestException(
          `Answer must not exceed ${question.validation.maxLength} characters`,
        );
      }
    }
  }
}
