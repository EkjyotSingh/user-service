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
import { Post } from './post.entity';

@Entity('poll_votes')
@Unique(['userId', 'postId', 'optionId'])
@Index(['postId'])
@Index(['userId'])
export class PollVote extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'post_id' })
    postId: string;

    @ManyToOne(() => Post)
    @JoinColumn({ name: 'post_id' })
    post: Post;

    @Column({ name: 'option_id' })
    optionId: string; // ID of the poll option voted for

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}

