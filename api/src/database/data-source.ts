// Used by the TypeORM CLI: npm run migration:generate -- src/database/migrations/Name
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration';
import { typeOrmOptions } from './typeorm.options';

loadEnv({ path: ['.env', '../.env'] });

export default new DataSource(typeOrmOptions(configuration().db));
