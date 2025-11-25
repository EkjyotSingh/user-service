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
import { ReactionEmoji } from './reaction-emoji.entity';

@Entity('post_reactions')
@Unique(['userId', 'postId', 'emojiId'])
@Index(['postId'])
@Index(['userId'])
@Index(['emojiId'])
export class PostReaction extends BaseEntity {
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

    @Column({ name: 'emoji_id' })
    emojiId: string;

    @ManyToOne(() => ReactionEmoji)
    @JoinColumn({ name: 'emoji_id' })
    emoji: ReactionEmoji;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}

