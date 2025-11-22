import { AuthProvider } from '../../auth/enums/auth-provider.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from 'typeorm';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, name: 'first_name' })
  firstName?: string;

  @Column({ nullable: true, name: 'last_name' })
  lastName?: string;

  @Column({ nullable: true, unique: true })
  email?: string;

  @Column({ nullable: true, select: false })
  password?: string;

  @Column({ nullable: true, unique: true })
  phone?: string;

  @Column({
    type: 'enum',
    enum: AuthProvider,
  })
  provider: AuthProvider;

  @Column({ nullable: true, name: 'provider_id' })
  providerId?: string;

  @Column({ default: false, name: 'is_email_verified' })
  isEmailVerified: boolean;

  @Column({ default: false, name: 'is_phone_verified' })
  isPhoneVerified: boolean;

  @Column({ default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @Column({ default: 0, name: 'failed_login_count' })
  failedLoginCount: number;

  @Column({
    type: 'timestamp',
    name: 'last_login_at',
    nullable: true,
  })
  lastLoginAt: Date;

  @Column({ default: false, name: 'is_advisor' })
  isAdvisor: boolean;

  @Column({ nullable: true, unique: true })
  username?: string;

  @Column({
    type: 'timestamp',
    name: 'guidelines_accepted_at',
    nullable: true,
  })
  guidelinesAcceptedAt?: Date;

  @Column({ nullable: true })
  avatar?: string;

  @Column({
    type: 'timestamp',
    name: 'terms_accepted_at',
    nullable: true,
  })
  termsAcceptedAt?: Date;

  @Column({ default: false, name: 'profile_completed' })
  profileCompleted: boolean;

  @Column({ default: false, name: 'questionnaire_completed' })
  questionnaireCompleted: boolean;

  @Column({
    type: 'timestamp',
    name: 'last_password_reset_at',
    nullable: true,
  })
  lastPasswordResetAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
