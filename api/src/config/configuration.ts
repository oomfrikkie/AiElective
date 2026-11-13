// All settings come from environment variables (see .env.example in the project root).
// Defaults are for local development; docker-compose overrides the hosts.

export interface AppConfig {
  port: number;
  corsOrigins: string[];
  jwt: { secret: string; expiresIn: string };
  db: { host: string; port: number; user: string; password: string; name: string };
  aiServiceUrl: string;
  throttle: { authLimit: number };
}

const DEV_JWT_SECRET = 'dev-only-secret-change-me';

export default (): AppConfig => {
  const env = process.env;
  const secret = env.JWT_SECRET || DEV_JWT_SECRET;
  if (env.NODE_ENV === 'production' && secret === DEV_JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
  }

  return {
    port: parseInt(env.API_PORT ?? env.PORT ?? '3000', 10),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    jwt: { secret, expiresIn: env.JWT_EXPIRES_IN ?? '7d' },
    db: {
      host: env.DB_HOST ?? 'localhost',
      port: parseInt(env.DB_PORT ?? '5432', 10),
      user: env.DB_USER ?? 'hettie',
      password: env.DB_PASSWORD ?? 'hettie',
      name: env.DB_NAME ?? 'hettie',
    },
    aiServiceUrl: (env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
    throttle: { authLimit: parseInt(env.THROTTLE_AUTH_LIMIT ?? '10', 10) },
  };
};
