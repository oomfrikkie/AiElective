import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiService, PastLesson } from '../ai/ai.service';
import { Lesson, LessonMistake } from './lesson.entity';
import { LessonAnswer } from './lesson-answer.entity';
import { AnswerDto } from './dto/lesson.dto';

const TRICKY_WORDS = 8;

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(LessonAnswer) private readonly answers: Repository<LessonAnswer>,
    private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  /** This learner's finished lessons in one level, oldest first, as the AI service wants them. */
  private async history(userId: string, level: string, exceptId?: string): Promise<PastLesson[]> {
    const done = await this.lessons.find({
      where: { userId, level, status: 'completed' },
      relations: { answers: true },
      order: { completedAt: 'ASC' },
    });
    return done
      .filter((l) => l.id !== exceptId)
      .map((l) => ({
        level: l.level,
        results: l.answers.map(({ word, guess, correct }) => ({ word, guess, correct })),
      }));
  }

  /**
   * The learner's open lesson for this level, or a new one. Resuming (instead of replacing)
   * keeps a refresh from reshuffling the words, and makes two quick starts harmless.
   */
  async start(userId: string, level: string) {
    const open = await this.lessons.findOne({
      where: { userId, level, status: 'in_progress' },
      order: { createdAt: 'DESC' },
    });
    if (open) return this.toStarted(open, (await this.ai.levels()).levels);

    const built = await this.ai.buildLesson(level, await this.history(userId, level));
    const lesson = await this.lessons.save(
      this.lessons.create({
        userId,
        level,
        status: 'in_progress',
        lessonNumber: built.lesson_number,
        groups: built.groups,
        lastWrong: built.last_wrong,
        total: built.groups.flat().length,
      }),
    );
    return this.toStarted(lesson, built.levels);
  }

  private toStarted(lesson: Lesson, levels: string[]) {
    return {
      id: lesson.id,
      level: lesson.level,
      levels,
      lessonNumber: lesson.lessonNumber,
      lastWrongCount: lesson.lastWrong.length,
      groups: lesson.groups,
    };
  }

  async submit(userId: string, lessonId: string, answers: AnswerDto[]) {
    const lesson = await this.lessons.findOneBy({ id: lessonId, userId });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.status === 'completed') throw new ConflictException('This lesson is already submitted');

    // Exactly one answer for every word in the lesson, nothing else.
    const expected = lesson.groups.flat().map((w) => w.word).sort();
    const given = answers.map((a) => a.word).sort();
    if (expected.length !== given.length || expected.some((w, i) => w !== given[i])) {
      throw new BadRequestException('Answer every word of this lesson exactly once');
    }

    const graded = await this.ai.gradeLesson(
      lesson.level,
      answers.map(({ word, guess }) => ({ word, guess })),
      lesson.lastWrong,
      await this.history(userId, lesson.level, lesson.id),
    );

    const mistakes: LessonMistake[] = graded.mistakes.map((m) => ({
      word: m.word,
      article: m.article,
      english: m.english,
      guess: m.guess,
      aiHint: m.ai_hint,
      teacherTip: m.teacher_tip,
    }));

    await this.dataSource.transaction(async (tx) => {
      // Guards against a double submit racing past the status check above.
      const { affected } = await tx.update(
        Lesson,
        { id: lesson.id, status: 'in_progress' },
        { status: 'completed', score: graded.score, completedAt: new Date(), mistakes },
      );
      if (affected !== 1) throw new ConflictException('This lesson is already submitted');
      // Any other open lesson in this level (e.g. from two starts at once) is now outdated.
      await tx.delete(Lesson, { userId, level: lesson.level, status: 'in_progress' });
      await tx.insert(
        LessonAnswer,
        graded.results.map((r) => ({
          lessonId: lesson.id,
          word: r.word,
          guess: r.guess,
          correct: r.correct,
          article: r.correct ? r.guess : r.guess === 'de' ? 'het' : 'de',
        })),
      );
    });

    return {
      lessonId: lesson.id,
      level: lesson.level,
      lessonNumber: lesson.lessonNumber,
      score: graded.score,
      total: graded.total,
      previous: graded.previous,
      fixed: graded.fixed,
      stillWrong: graded.still_wrong,
      mistakes,
    };
  }

  async list(userId: string, level?: string, limit = 20) {
    const lessons = await this.lessons.find({
      where: { userId, status: 'completed', ...(level && { level }) },
      order: { completedAt: 'DESC' },
      take: limit,
    });
    return lessons.map((l) => ({
      id: l.id,
      level: l.level,
      lessonNumber: l.lessonNumber,
      score: l.score,
      total: l.total,
      completedAt: l.completedAt,
    }));
  }

  async findOne(userId: string, id: string) {
    const lesson = await this.lessons.findOne({
      where: { id, userId },
      relations: { answers: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return {
      id: lesson.id,
      level: lesson.level,
      status: lesson.status,
      lessonNumber: lesson.lessonNumber,
      score: lesson.score,
      total: lesson.total,
      createdAt: lesson.createdAt,
      completedAt: lesson.completedAt,
      answers: lesson.answers.map(({ word, guess, article, correct }) => ({ word, guess, article, correct })),
      mistakes: lesson.mistakes ?? [],
    };
  }

  async stats(userId: string) {
    const perLevel = await this.lessons
      .createQueryBuilder('l')
      .select('l.level', 'level')
      .addSelect('COUNT(*)::int', 'lessonsCompleted')
      .addSelect('COALESCE(SUM(l.score), 0)::int', 'correct')
      .addSelect('COALESCE(SUM(l.total), 0)::int', 'answered')
      .addSelect('MAX(l.score)::int', 'bestScore')
      .where('l.user_id = :userId AND l.status = :status', { userId, status: 'completed' })
      .groupBy('l.level')
      .orderBy('l.level')
      .getRawMany<{ level: string; lessonsCompleted: number; correct: number; answered: number; bestScore: number }>();

    const latest = await this.lessons
      .createQueryBuilder('l')
      .distinctOn(['l.level'])
      .select(['l.level', 'l.score', 'l.total'])
      .where('l.user_id = :userId AND l.status = :status', { userId, status: 'completed' })
      .orderBy('l.level')
      .addOrderBy('l.completed_at', 'DESC')
      .getMany();

    const wordsPracticed = await this.answers
      .createQueryBuilder('a')
      .innerJoin('a.lesson', 'l')
      .select('l.level', 'level')
      .addSelect('COUNT(DISTINCT a.word)::int', 'words')
      .where('l.user_id = :userId', { userId })
      .groupBy('l.level')
      .getRawMany<{ level: string; words: number }>();

    // Words this learner gets wrong most often, across all levels.
    const trickyWords = await this.answers
      .createQueryBuilder('a')
      .innerJoin('a.lesson', 'l')
      .select('a.word', 'word')
      .addSelect('a.article', 'article')
      .addSelect('l.level', 'level')
      .addSelect('SUM(CASE WHEN a.correct THEN 0 ELSE 1 END)::int', 'wrong')
      .addSelect('COUNT(*)::int', 'seen')
      .where('l.user_id = :userId', { userId })
      .groupBy('a.word')
      .addGroupBy('a.article')
      .addGroupBy('l.level')
      .having('SUM(CASE WHEN a.correct THEN 0 ELSE 1 END) > 0')
      .orderBy('wrong', 'DESC')
      .addOrderBy('seen', 'ASC')
      .addOrderBy('a.word', 'ASC')
      .limit(TRICKY_WORDS)
      .getRawMany<{ word: string; article: string; level: string; wrong: number; seen: number }>();

    const levels = perLevel.map((row) => {
      const last = latest.find((l) => l.level === row.level);
      return {
        level: row.level,
        lessonsCompleted: row.lessonsCompleted,
        accuracy: row.answered ? Math.round((row.correct / row.answered) * 100) : 0,
        bestScore: row.bestScore,
        lastScore: last?.score ?? null,
        lessonSize: last?.total ?? null,
        wordsPracticed: wordsPracticed.find((w) => w.level === row.level)?.words ?? 0,
      };
    });

    const answered = perLevel.reduce((n, r) => n + r.answered, 0);
    const correct = perLevel.reduce((n, r) => n + r.correct, 0);
    return {
      totalLessons: perLevel.reduce((n, r) => n + r.lessonsCompleted, 0),
      accuracy: answered ? Math.round((correct / answered) * 100) : 0,
      levels,
      trickyWords,
    };
  }
}
