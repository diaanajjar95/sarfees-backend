import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { AllExceptionsFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Admin portal lives on its own origin in dev and (typically) in prod.
  // ADMIN_PORTAL_ORIGIN can be a comma-separated list to allow multiple deploys.
  const adminOrigins = (
    process.env.ADMIN_PORTAL_ORIGIN ?? 'http://localhost:3001'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: adminOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
  });

  app.useGlobalPipes(
    new I18nValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Order matters: the I18n validation filter normalizes validation errors,
  // then our AllExceptionsFilter wraps everything in the standard envelope.
  app.useGlobalFilters(
    new I18nValidationExceptionFilter(),
    new AllExceptionsFilter(),
  );

  // Wrap every successful response in { code, message, data }.
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
  if (swaggerEnabled) {
    const swaggerPath = process.env.SWAGGER_PATH || 'api';
    const config = new DocumentBuilder()
      .setTitle('Sarfees API')
      .setDescription('The Sarfees API description')
      .setVersion('1.0')
      .addBearerAuth()
      .addGlobalParameters({
        in: 'header',
        required: false,
        name: 'Accept-Language',
        schema: { example: 'ar' },
      })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
