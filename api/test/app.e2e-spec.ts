import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { AiService, PastLesson } from '../src/ai/ai.service';

// A fake AI service: twelve fixed words with known articles, so the tests run without
// Python or Gemini and every score is predictable.
const ARTICLES: Record<string, string> = {
  huis: 'het', stoel: 'de', meisje: 'het', tafel: 'de', boek: 'het', kat: 'de',
  water: 'het', man: 'de', paard: 'het', vrouw: 'de', bed: 'het', appel: 'de',
};
const WORDS = Object.keys(ARTICLES);

const fakeAi = {
  levels: async () => ({ levels: ['A1', 'A2'] }),
  isUp: async () => true,
  buildLesson: async (level: string, history: PastLesson[]) => {
    if (level === 'B1') throw new NotFoundException("Unknown level 'B1'.");
    const last = history[history.length - 1];
    return {
      level,
      levels: ['A1', 'A2'],
      lesson_number: history.length + 1,
      last_wrong: last ? last.results.filter((r) => !r.correct).map((r) => r.word) : [],
      groups: [0, 4, 8].map((i) => WORDS.slice(i, i + 4).map((word) => ({ word, english: word }))),
    };
  },
  gradeLesson: async (level: string, answers: { word: string; guess: string }[], lastWrong: string[], history: PastLesson[]) => {
    const results = answers.map((a) => ({ ...a, correct: ARTICLES[a.word] === a.guess }));
    const prev = history[history.length - 1];
    return {
      level,
      results,
      score: results.filter((r) => r.correct).length,
      total: results.length,
      previous: prev ? prev.results.filter((r) => r.correct).length : null,
      fixed: results.filter((r) => r.correct && lastWrong.includes(r.word)).map((r) => r.word),
      still_wrong: results.filter((r) => !r.correct && lastWrong.includes(r.word)).map((r) => r.word),
      mistakes: results
        .filter((r) => !r.correct)
        .map((r) => ({ word: r.word, article: ARTICLES[r.word], english: r.word, guess: r.guess, ai_hint: 'hint', teacher_tip: 'tip' })),
    };
  },
};

describe('HettieAI API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue(fakeAi)
      .compile();
    app = setupApp(moduleRef.createNestApplication());
    await app.init();

    // Fresh schema for every run, built by the real migrations.
    const ds = app.get(DataSource);
    await ds.dropDatabase();
    await ds.runMigrations();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  const register = (email: string, password = 'password123', displayName = 'Learner') =>
    http.post('/auth/register').send({ email, password, displayName });

  async function tokenFor(email: string) {
    const res = await register(email);
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  }

  const answersFor = (groups: { word: string }[][], correct: (word: string) => boolean) =>
    groups.flat().map(({ word }) => ({
      word,
      guess: correct(word) ? ARTICLES[word] : ARTICLES[word] === 'de' ? 'het' : 'de',
    }));

  describe('health', () => {
    it('reports database and AI service', async () => {
      const res = await http.get('/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', database: true, aiService: true });
    });
  });

  describe('auth', () => {
    it('registers a user with default settings and never returns the password', async () => {
      const res = await register('New.User@Example.com').expect(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        email: 'new.user@example.com',
        displayName: 'Learner',
        settings: { mode: 'text', voice: 'Kore', lessonLevel: 'A1', conversationLevel: 'A1' },
      });
      expect(JSON.stringify(res.body)).not.toContain('password');
    });

    it('rejects a duplicate email, whatever the case', async () => {
      await register('dup@example.com').expect(201);
      await register('DUP@example.com').expect(409);
    });

    it('validates the input', async () => {
      const res = await http.post('/auth/register').send({ email: 'nope', password: 'short', displayName: '' }).expect(400);
      expect(res.body.message.join(' ')).toMatch(/email/);
      expect(res.body.message.join(' ')).toMatch(/password/);
    });

    it('logs in with the right password only', async () => {
      await register('login@example.com', 'correct-horse');
      const ok = await http.post('/auth/login').send({ email: 'LOGIN@example.com', password: 'correct-horse' }).expect(200);
      expect(ok.body.user.email).toBe('login@example.com');
      const bad = await http.post('/auth/login').send({ email: 'login@example.com', password: 'wrong-horse' }).expect(401);
      const unknown = await http.post('/auth/login').send({ email: 'ghost@example.com', password: 'wrong-horse' }).expect(401);
      expect(bad.body.message).toBe(unknown.body.message); // doesn't reveal which emails exist
    });

    it('protects user routes', async () => {
      await http.get('/users/me').expect(401);
      await http.get('/users/me').set('Authorization', 'Bearer not-a-token').expect(401);
    });
  });

  describe('users', () => {
    it('updates profile and settings', async () => {
      const token = await tokenFor('profile@example.com');
      const auth = { Authorization: `Bearer ${token}` };

      await http.patch('/users/me').set(auth).send({ displayName: '  Sam  ' }).expect(200)
        .expect((res) => expect(res.body.displayName).toBe('Sam'));

      await http.patch('/users/me/settings').set(auth).send({ mode: 'voice', voice: 'Puck', lessonLevel: 'A2' }).expect(200)
        .expect((res) => expect(res.body).toEqual({ mode: 'voice', voice: 'Puck', lessonLevel: 'A2', conversationLevel: 'A1' }));

      await http.patch('/users/me/settings').set(auth).send({ mode: 'telepathy' }).expect(400);
      await http.patch('/users/me/settings').set(auth).send({ isAdmin: true }).expect(400);

      const me = await http.get('/users/me').set(auth).expect(200);
      expect(me.body.settings.mode).toBe('voice');
    });

    it('changes the password', async () => {
      const token = await tokenFor('pw@example.com');
      const auth = { Authorization: `Bearer ${token}` };
      await http.patch('/users/me/password').set(auth).send({ currentPassword: 'wrong-one', newPassword: 'brand-new-pw' }).expect(401);
      await http.patch('/users/me/password').set(auth).send({ currentPassword: 'password123', newPassword: 'brand-new-pw' }).expect(204);
      await http.post('/auth/login').send({ email: 'pw@example.com', password: 'brand-new-pw' }).expect(200);
    });

    it('deletes the account and everything in it', async () => {
      const token = await tokenFor('bye@example.com');
      const auth = { Authorization: `Bearer ${token}` };
      const lesson = await http.post('/lessons').set(auth).send({ level: 'A1' }).expect(201);
      await http.delete('/users/me').set(auth).send({ password: 'nope-nope' }).expect(401);
      await http.delete('/users/me').set(auth).send({ password: 'password123' }).expect(204);
      await http.get('/users/me').set(auth).expect(401); // token of a deleted user is dead
      const left = await app.get(DataSource).query('SELECT count(*)::int AS n FROM lessons WHERE id = $1', [lesson.body.id]);
      expect(left[0].n).toBe(0);
    });
  });

  describe('lessons', () => {
    it('runs a full lesson: start, submit, mistakes come back, stats', async () => {
      const token = await tokenFor('lessons@example.com');
      const auth = { Authorization: `Bearer ${token}` };

      const first = await http.post('/lessons').set(auth).send({ level: 'A1' }).expect(201);
      expect(first.body).toMatchObject({ level: 'A1', lessonNumber: 1, lastWrongCount: 0 });
      expect(first.body.groups.flat()).toHaveLength(12);

      // Get 'huis' and 'stoel' wrong.
      const wrong = ['huis', 'stoel'];
      const graded = await http.post(`/lessons/${first.body.id}/submit`).set(auth)
        .send({ answers: answersFor(first.body.groups, (w) => !wrong.includes(w)) }).expect(200);
      expect(graded.body).toMatchObject({ score: 10, total: 12, previous: null });
      expect(graded.body.mistakes.map((m: { word: string }) => m.word).sort()).toEqual(wrong);

      // Submitting twice is refused.
      await http.post(`/lessons/${first.body.id}/submit`).set(auth)
        .send({ answers: answersFor(first.body.groups, () => true) }).expect(409);

      // The next lesson knows about the mistakes.
      const second = await http.post('/lessons').set(auth).send({ level: 'A1' }).expect(201);
      expect(second.body).toMatchObject({ lessonNumber: 2, lastWrongCount: 2 });
      const regraded = await http.post(`/lessons/${second.body.id}/submit`).set(auth)
        .send({ answers: answersFor(second.body.groups, (w) => w !== 'huis') }).expect(200);
      expect(regraded.body).toMatchObject({ score: 11, previous: 10, fixed: ['stoel'], stillWrong: ['huis'] });

      const list = await http.get('/lessons?level=A1').set(auth).expect(200);
      expect(list.body.map((l: { score: number }) => l.score)).toEqual([11, 10]);

      const detail = await http.get(`/lessons/${first.body.id}`).set(auth).expect(200);
      expect(detail.body.answers).toHaveLength(12);
      expect(detail.body.mistakes).toHaveLength(2);

      const stats = await http.get('/lessons/stats').set(auth).expect(200);
      expect(stats.body).toMatchObject({ totalLessons: 2, accuracy: 88 });
      expect(stats.body.levels[0]).toMatchObject({ level: 'A1', lessonsCompleted: 2, bestScore: 11, lastScore: 11, wordsPracticed: 12 });
      expect(stats.body.trickyWords[0]).toMatchObject({ word: 'huis', article: 'het', wrong: 2 });
    });

    it('resumes an open lesson instead of starting a second one', async () => {
      const auth = { Authorization: `Bearer ${await tokenFor('resume@example.com')}` };
      const [a, b] = await Promise.all([
        http.post('/lessons').set(auth).send({ level: 'A1' }),
        http.post('/lessons').set(auth).send({ level: 'A1' }),
      ]);
      // Even two starts at the same moment leave a lesson that can be submitted...
      await http.post(`/lessons/${b.body.id}/submit`).set(auth)
        .send({ answers: answersFor(b.body.groups, () => true) }).expect(200);
      // ...and afterwards no stale open lesson is left over.
      const next = await http.post('/lessons').set(auth).send({ level: 'A1' }).expect(201);
      expect(next.body.lessonNumber).toBe(2);
      expect([a.body.id, b.body.id]).not.toContain(next.body.id);

      // A refresh mid-lesson gets the same lesson back.
      const again = await http.post('/lessons').set(auth).send({ level: 'A1' }).expect(201);
      expect(again.body.id).toBe(next.body.id);
    });

    it('rejects answers that do not match the lesson', async () => {
      const token = await tokenFor('cheat@example.com');
      const auth = { Authorization: `Bearer ${token}` };
      const lesson = await http.post('/lessons').set(auth).send({ level: 'A1' }).expect(201);
      const answers = answersFor(lesson.body.groups, () => true);

      await http.post(`/lessons/${lesson.body.id}/submit`).set(auth).send({ answers: answers.slice(1) }).expect(400);
      await http.post(`/lessons/${lesson.body.id}/submit`).set(auth)
        .send({ answers: [...answers.slice(1), { word: 'fiets', guess: 'de' }] }).expect(400);
      await http.post(`/lessons/${lesson.body.id}/submit`).set(auth)
        .send({ answers: answers.map((a) => ({ ...a, guess: 'maybe' })) }).expect(400);
    });

    it("keeps learners' lessons apart", async () => {
      const alice = { Authorization: `Bearer ${await tokenFor('alice@example.com')}` };
      const bob = { Authorization: `Bearer ${await tokenFor('bob@example.com')}` };
      const lesson = await http.post('/lessons').set(alice).send({ level: 'A1' }).expect(201);
      await http.get(`/lessons/${lesson.body.id}`).set(bob).expect(404);
      await http.post(`/lessons/${lesson.body.id}/submit`).set(bob)
        .send({ answers: answersFor(lesson.body.groups, () => true) }).expect(404);
    });

    it('passes AI service errors on', async () => {
      const auth = { Authorization: `Bearer ${await tokenFor('b1@example.com')}` };
      await http.post('/lessons').set(auth).send({ level: 'B1' }).expect(404);
      await http.post('/lessons').set(auth).send({ level: 'C2' }).expect(400);
    });

    it('lists levels without logging in', async () => {
      await http.get('/lessons/levels').expect(200).expect({ levels: ['A1', 'A2'] });
    });
  });

  describe('conversation completions', () => {
    it('records finished scenarios and summarises them', async () => {
      const auth = { Authorization: `Bearer ${await tokenFor('talk@example.com')}` };
      const body = { level: 'A1', scenarioId: 'cafe', scenarioTitle: 'In het café', turns: 6, corrections: 2 };
      await http.post('/conversations/completions').set(auth).send(body).expect(201);
      await http.post('/conversations/completions').set(auth).send({ ...body, turns: 4 }).expect(201);
      await http.post('/conversations/completions').set(auth).send({ ...body, scenarioId: '../etc' }).expect(400);

      const list = await http.get('/conversations/completions').set(auth).expect(200);
      expect(list.body).toHaveLength(2);
      const summary = await http.get('/conversations/completions/summary').set(auth).expect(200);
      expect(summary.body).toEqual([
        expect.objectContaining({ level: 'A1', scenarioId: 'cafe', timesCompleted: 2, bestTurns: 4 }),
      ]);
    });
  });
});
