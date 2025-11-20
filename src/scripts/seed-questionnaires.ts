import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { QuestionnaireSeeder } from '../modules/questionnaire/questionnaire.seeder';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(QuestionnaireSeeder);

  try {
    await seeder.seed();
    console.log('✅ Questionnaire seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding questionnaires:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
