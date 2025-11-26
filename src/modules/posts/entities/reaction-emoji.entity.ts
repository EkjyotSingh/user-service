import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    BaseEntity,
    Index,
} from 'typeorm';

@Entity('reaction_emojis')
@Index(['code'], { unique: true })
export class ReactionEmoji extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    code: string; // e.g., '👍', '❤️', '😂', '😮', '😢', '🙌'

    @Column()
    name: string; // e.g., 'Like', 'Love', 'Haha', 'Wow', 'Sad', 'Celebrate'

    @Column({ default: true, name: 'is_active' })
    isActive: boolean;

    @Column({ default: 0, name: 'display_order' })
    displayOrder: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

