import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(AppConfigService);

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Service B (NestJS) - Log Aggregation & Reports API')
    .setDescription('NestJS microservice for log aggregation, querying, and PDF report generation')
    .setVersion('1.0')
    .addTag('Logs')
    .addTag('Reports')
    .addTag('Health')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(configService.port);
  logger.log(`Service B (NestJS) is running on port ${configService.port}. Swagger available at http://localhost:${configService.port}/api/docs`);
}

bootstrap();
