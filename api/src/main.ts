import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = setupApp(await NestFactory.create(AppModule));
  const port = app.get(ConfigService).getOrThrow<number>('port');
  await app.listen(port, '0.0.0.0');
  Logger.log(`HettieAI API listening on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
