import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,                          // Remove fields that are not in DTO
      forbidNonWhitelisted: false,              // Optional: throw error if extra fields provided
      transform: true,                          // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,         // Allows type conversion (string → number)
      },
    }),
  );

  const configService = app.get(ConfigService);

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle(configService.get<string>('PROJECT_NAME') || "Backend Api's")
    .setDescription('Auth + other APIs')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = configService.get<number>('PORT') || 3000;

  await app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
bootstrap();
