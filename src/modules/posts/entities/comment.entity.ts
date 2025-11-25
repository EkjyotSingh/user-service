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
import { Post } from './post.entity';

@Entity('comments')
@Index(['postId'])
@Index(['userId'])
@Index(['parentCommentId'])
export class Comment extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'post_id' })
    postId: string;

    @ManyToOne(() => Post)
    @JoinColumn({ name: 'post_id' })
    post: Post;

    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'parent_comment_id', nullable: true })
    parentCommentId?: string;

    @ManyToOne(() => Comment, { nullable: true })
    @JoinColumn({ name: 'parent_comment_id' })
    parentComment?: Comment;

    @Column('text')
    content: string;

    @Column({ default: 0, name: 'like_count' })
    likeCount: number;

    @Column({ default: false, name: 'is_deleted' })
    isDeleted: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

