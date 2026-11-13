import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Shared by main.ts and the e2e tests, so tests run the app exactly as in production.
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.getOrThrow<string[]>('corsOrigins') });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  return app;
}
