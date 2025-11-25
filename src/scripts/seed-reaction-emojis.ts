import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ReactionEmojiSeeder } from '../modules/posts/reaction-emoji.seeder';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const seeder = app.get(ReactionEmojiSeeder);

    try {
        await seeder.seed();
        console.log('✅ Reaction emoji seeding completed successfully!');
    } catch (error) {
        console.error('❌ Error seeding reaction emojis:', error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

bootstrap();

