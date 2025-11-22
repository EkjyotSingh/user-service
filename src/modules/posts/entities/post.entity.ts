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

export enum PostType {
    TEXT = 'text',
    TEXT_WITH_IMAGES = 'text_with_images',
    POLL = 'poll',
    POLL_WITH_IMAGES = 'poll_with_images',
}

export interface PollOption {
    id: string; // Unique identifier for the option
    text: string;
    imageUrl?: string; // Optional image URL for the option
    voteCount: number;
}

@Entity('posts')
@Index(['userId'])
@Index(['category'])
@Index(['createdAt'])
export class Post extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'text', nullable: true })
    content?: string;

    @Column({
        type: 'enum',
        enum: PostType,
        default: PostType.TEXT,
    })
    type: PostType;

    @Column({ type: 'json', nullable: true, name: 'image_urls' })
    imageUrls?: string[]; // Array of image URLs

    @Column({ nullable: true })
    category?: string; // e.g., 'Finance', 'Marketing', 'Ever'

    @Column({ default: 0, name: 'reaction_count' })
    reactionCount: number;

    @Column({ default: 0, name: 'comment_count' })
    commentCount: number;

    @Column({ default: 0, name: 'share_count' })
    shareCount: number;

    // Poll-specific fields
    @Column({ type: 'text', nullable: true })
    question?: string; // Poll question

    @Column({ type: 'jsonb', nullable: true })
    pollOptions?: PollOption[]; // Array of poll options with text, imageUrl, and voteCount

    @Column({ default: false, name: 'multiple_selection' })
    multipleSelection: boolean; // Whether users can select multiple options (for polls)

    @Column({ type: 'integer', nullable: true, name: 'duration_days' })
    durationDays?: number; // Poll duration in days (e.g., 7, 30)

    @Column({
        type: 'timestamp',
        nullable: true,
        name: 'expires_at',
    })
    expiresAt?: Date; // Calculated from durationDays (for polls)

    @Column({ default: 0, name: 'total_votes' })
    totalVotes: number; // Total votes count (for polls)

    @Column({ default: false, name: 'is_closed' })
    isClosed: boolean; // Whether the poll is closed

    @Column({ default: false, name: 'is_deleted' })
    isDeleted: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

