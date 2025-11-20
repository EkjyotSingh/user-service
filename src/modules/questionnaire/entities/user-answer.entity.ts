import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BaseEntity,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Question } from './question.entity';

@Entity('user_answers')
@Index(['userId', 'questionId'], { unique: true })
export class UserAnswer extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'question_id' })
  @Index()
  questionId: string;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'question_id' })
  question: Question;

  @Column({ type: 'text', nullable: true, name: 'text_answer' })
  textAnswer?: string;

  @Column({ type: 'json', nullable: true, name: 'selected_options' })
  selectedOptions?: string[]; // Array of option IDs for multiple choice

  @Column({ type: 'text', nullable: true, name: 'file_url' })
  fileUrl?: string; // For file uploads

  @Column({ type: 'text', nullable: true, name: 'file_name' })
  fileName?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
