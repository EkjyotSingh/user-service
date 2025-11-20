import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';
import { QuestionnaireSeeder } from './questionnaire.seeder';
import { Questionnaire } from './entities/questionnaire.entity';
import { Question } from './entities/question.entity';
import { QuestionOption } from './entities/question-option.entity';
import { UserAnswer } from './entities/user-answer.entity';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { S3StorageService } from '../../common/services/s3-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Questionnaire, Question, QuestionOption, UserAnswer]),
    ConfigModule,
    UsersModule,
    SessionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get('JWT_SECRET') || 'changeme',
        signOptions: { expiresIn: cfg.get('JWT_EXPIRES_IN') || '3600s' },
      }),
    }),
  ],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService, QuestionnaireSeeder, JwtAuthGuard, S3StorageService],
  exports: [QuestionnaireService, QuestionnaireSeeder],
})
export class QuestionnaireModule { }
