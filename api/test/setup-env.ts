// e2e tests use their own database so they never touch your dev data.
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'hettie_test';
process.env.JWT_SECRET = 'e2e-test-secret';
process.env.THROTTLE_AUTH_LIMIT = '1000';
