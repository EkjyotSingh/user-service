import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
    BaseEntity,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from './comment.entity';

@Entity('comment_likes')
@Unique(['userId', 'commentId'])
@Index(['commentId'])
@Index(['userId'])
export class CommentLike extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'comment_id' })
    commentId: string;

    @ManyToOne(() => Comment)
    @JoinColumn({ name: 'comment_id' })
    comment: Comment;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}

