import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_sessions')
@Index(['user', 'deviceId'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.sessions, { onDelete: 'CASCADE' })
  user: User;

  @Column({ length: 128, name: 'device_id' })
  deviceId: string;

  @Column({ nullable: true })
  ip?: string;

  @Column({ type: 'text', nullable: true, name: "user_agent" })
  userAgent?: string;

  @Column({ default: true, name: "is_active" })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true, name: "expired_at" })
  expiresAt?: Date;
  
  @CreateDateColumn({ type: 'timestamp', name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: "updated_at" })
  updatedAt: Date;
}
