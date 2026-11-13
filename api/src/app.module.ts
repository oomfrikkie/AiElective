import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration, { AppConfig } from './config/configuration';
import { typeOrmOptions } from './database/typeorm.options';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LessonsModule } from './lessons/lessons.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // api/.env first, then the shared project .env one folder up.
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: ['.env', '../.env'] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => typeOrmOptions(config.getOrThrow<AppConfig['db']>('db')),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { name: 'auth', ttl: 60_000, limit: config.getOrThrow<number>('throttle.authLimit') },
      ],
    }),
    AuthModule,
    UsersModule,
    LessonsModule,
    ConversationsModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
