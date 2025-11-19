import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  BaseEntity,
} from 'typeorm';
import { Questionnaire } from './questionnaire.entity';
import { QuestionOption } from './question-option.entity';

export enum QuestionType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  SINGLE_CHOICE = 'single_choice',
  MULTIPLE_CHOICE = 'multiple_choice',
  FILE_UPLOAD = 'file_upload',
}

export enum DisplayStyle {
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  TAB = 'tab',
  TEXT_INPUT = 'text_input',
  TEXTAREA = 'textarea',
  FILE_UPLOAD = 'file_upload',
}

@Entity('questions')
export class Question extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'questionnaire_id' })
  questionnaireId: string;

  @ManyToOne(() => Questionnaire, (questionnaire) => questionnaire.questions)
  @JoinColumn({ name: 'questionnaire_id' })
  questionnaire: Questionnaire;

  @Column()
  text: string;

  @Column({ type: 'text', nullable: true })
  subtitle?: string;

  @Column({
    type: 'enum',
    enum: QuestionType,
  })
  type: QuestionType;

  @Column({
    type: 'enum',
    enum: DisplayStyle,
    nullable: true,
    name: 'display_style',
  })
  displayStyle?: DisplayStyle;

  @Column({ name: 'is_required', default: true })
  isRequired: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @Column({ name: 'step_number', default: 1 })
  stepNumber: number;

  @Column({ type: 'json', nullable: true })
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };

  @OneToMany(() => QuestionOption, (option) => option.question, {
    cascade: true,
  })
  options: QuestionOption[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
