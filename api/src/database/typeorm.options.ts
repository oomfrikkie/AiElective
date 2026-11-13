import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { AppConfig } from '../config/configuration';
import { User } from '../users/user.entity';
import { UserSettings } from '../users/user-settings.entity';
import { Lesson } from '../lessons/lesson.entity';
import { LessonAnswer } from '../lessons/lesson-answer.entity';
import { ScenarioCompletion } from '../conversations/scenario-completion.entity';

export const ENTITIES = [User, UserSettings, Lesson, LessonAnswer, ScenarioCompletion];

// Shared by the Nest app and the TypeORM CLI (data-source.ts), so migrations and the app
// always agree. The schema is managed by migrations only: synchronize stays off.
export function typeOrmOptions(db: AppConfig['db']): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.name,
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsRun: true,
    synchronize: false,
    uuidExtension: 'pgcrypto', // gen_random_uuid(), built into Postgres 13+
  };
}
