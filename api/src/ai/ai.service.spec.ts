import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService', () => {
  const service = new AiService({ getOrThrow: () => 'http://ai.test' } as unknown as ConfigService);
  const reply = (status: number, body: unknown) =>
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

  afterEach(() => jest.restoreAllMocks());

  it('sends the history in the shape the Python service expects', async () => {
    const spy = reply(200, { levels: ['A1'] });
    await service.gradeLesson('A1', [{ word: 'huis', guess: 'het' }], ['huis'], []);
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('http://ai.test/lesson/grade');
    expect(JSON.parse(init!.body as string)).toEqual({
      level: 'A1',
      answers: [{ word: 'huis', guess: 'het' }],
      last_wrong: ['huis'],
      history: [],
    });
  });

  it('passes client errors on with their status and message', async () => {
    reply(404, { detail: "Unknown level 'B1'." });
    await expect(service.buildLesson('B1', [])).rejects.toMatchObject({
      status: 404,
      message: "Unknown level 'B1'.",
    });
  });

  it('hides server errors behind a 503', async () => {
    reply(500, { detail: 'Traceback with secrets' });
    const error = await service.levels().catch((e) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.message).not.toContain('secrets');
  });

  it('turns a network failure into a 503', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(service.levels()).rejects.toBeInstanceOf(HttpException);
    expect(await service.isUp()).toBe(false);
  });
});
