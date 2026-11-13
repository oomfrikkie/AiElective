import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Types of the Python AI service (backend/app/main.py). It uses snake_case.
export interface PastLesson {
  level: string;
  results: { word: string; guess: string; correct: boolean }[];
}

export interface BuiltLesson {
  level: string;
  levels: string[];
  lesson_number: number;
  last_wrong: string[];
  groups: { word: string; english: string }[][];
}

export interface GradedLesson {
  level: string;
  results: { word: string; guess: string; correct: boolean }[];
  score: number;
  total: number;
  previous: number | null;
  fixed: string[];
  still_wrong: string[];
  mistakes: {
    word: string;
    article: string;
    english: string;
    guess: string;
    ai_hint: string | null;
    teacher_tip: string | null;
  }[];
}

const TIMEOUT_MS = 30_000; // grading waits for Gemini tips, which can take a few seconds

/** HTTP client for the Python AI service (de/het network + Gemini). */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('aiServiceUrl');
  }

  levels() {
    return this.request<{ levels: string[] }>('GET', '/lesson/levels');
  }

  buildLesson(level: string, history: PastLesson[]) {
    return this.request<BuiltLesson>('POST', '/lesson/build', { level, history });
  }

  gradeLesson(
    level: string,
    answers: { word: string; guess: string }[],
    lastWrong: string[],
    history: PastLesson[],
  ) {
    return this.request<GradedLesson>('POST', '/lesson/grade', {
      level,
      answers,
      last_wrong: lastWrong,
      history,
    });
  }

  async isUp(): Promise<boolean> {
    try {
      await this.request('GET', '/health');
      return true;
    } catch {
      return false;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      this.logger.error(`AI service unreachable (${method} ${path}): ${(e as Error).message}`);
      throw new ServiceUnavailableException('The AI service is not available right now');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Pass the AI service's own client errors on (e.g. unknown level); hide server errors.
      if (res.status < 500) {
        throw new HttpException(data?.detail ?? 'AI service rejected the request', res.status);
      }
      this.logger.error(`AI service error ${res.status} on ${method} ${path}: ${JSON.stringify(data)}`);
      throw new ServiceUnavailableException('The AI service had a problem, try again');
    }
    return data as T;
  }
}
