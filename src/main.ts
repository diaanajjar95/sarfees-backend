import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { AllExceptionsFilter } from './shared/filters/http-exception.filter';
import {
  Audience,
  filterDocumentForAudience,
} from './shared/swagger/audience-filter';

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

    // Build the full document once, then derive per-audience views from it.
    // New endpoints land in the right doc automatically as long as the URL
    // prefix matches the convention encoded in audience-filter.ts.
    const fullConfig = new DocumentBuilder()
      .setTitle('Sarfees API')
      .setDescription(
        'Combined API surface. For app-team views see ' +
          `\`/${swaggerPath}/passenger\`, \`/${swaggerPath}/driver\`, ` +
          `and \`/${swaggerPath}/admin\`.`,
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addGlobalParameters({
        in: 'header',
        required: false,
        name: 'Accept-Language',
        schema: { example: 'ar' },
      })
      .build();
    const fullDocument = SwaggerModule.createDocument(app, fullConfig);
    SwaggerModule.setup(swaggerPath, app, fullDocument, {
      swaggerOptions: { persistAuthorization: true },
    });

    // Audience-scoped views. Each is a filtered clone of the full doc with
    // its own title/description so the swagger-ui header reads correctly.
    const audienceMeta: Record<
      Audience,
      { title: string; description: string }
    > = {
      passenger: {
        title: 'Sarfees Passenger API',
        description:
          'Endpoints consumed by the rider/passenger mobile app: OTP auth, ' +
          'profile, trips, packages, cities, FAQ, in-app notifications, and ' +
          '`/app/init` config.',
      },
      driver: {
        title: 'Sarfees Driver API',
        description:
          'Endpoints consumed by the driver mobile app: OTP auth, driver ' +
          'profile/preferences, trip lifecycle (offer → accept → start → ' +
          'pickup → dropoff → complete/cancel), notifications, FAQ, and ' +
          '`/app/init` config.',
      },
      admin: {
        title: 'Sarfees Admin API',
        description:
          'Endpoints consumed by the internal admin portal: admin auth, ' +
          'driver management, trip ops, earnings, passenger-request triage, ' +
          'announcements, FAQ management, and dev seeders.',
      },
    };

    for (const audience of ['passenger', 'driver', 'admin'] as const) {
      const meta = audienceMeta[audience];
      const filtered = filterDocumentForAudience(fullDocument, audience);
      filtered.info = {
        ...filtered.info,
        title: meta.title,
        description: meta.description,
      };
      SwaggerModule.setup(`${swaggerPath}/${audience}`, app, filtered, {
        swaggerOptions: { persistAuthorization: true },
      });
    }
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
