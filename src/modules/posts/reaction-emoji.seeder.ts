import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReactionEmoji } from './entities/reaction-emoji.entity';

@Injectable()
export class ReactionEmojiSeeder {
    constructor(
        @InjectRepository(ReactionEmoji)
        private reactionEmojiRepo: Repository<ReactionEmoji>,
    ) { }

    async seed() {
        // Check if emojis already exist
        const existing = await this.reactionEmojiRepo.count();
        if (existing > 0) {
            console.log('Reaction emojis already seeded. Skipping...');
            return;
        }

        const emojis = [
            { code: '👍', name: 'Like', description: 'Thumbs up', displayOrder: 1 },
            { code: '❤️', name: 'Love', description: 'Red heart', displayOrder: 2 },
            { code: '😂', name: 'Haha', description: 'Face with tears of joy', displayOrder: 3 },
            { code: '😮', name: 'Wow', description: 'Face with open mouth', displayOrder: 4 },
            { code: '😢', name: 'Sad', description: 'Crying face', displayOrder: 5 },
            { code: '🙌', name: 'Celebrate', description: 'Raising hands', displayOrder: 6 },
            { code: '🔥', name: 'Fire', description: 'Fire emoji', displayOrder: 7 },
            { code: '💯', name: '100', description: 'Hundred points', displayOrder: 8 },
        ];

        for (const emoji of emojis) {
            await this.reactionEmojiRepo.save(
                this.reactionEmojiRepo.create({
                    ...emoji,
                    isActive: true,
                }),
            );
        }

        console.log('Reaction emojis seeded successfully!');
    }
}

