import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Lesson } from './lesson.entity';

// One answered word. A row per word (instead of a JSON blob on the lesson) makes the stats
// easy to query, e.g. "which words does this learner get wrong most often?".
@Entity('lesson_answers')
export class LessonAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => Lesson, (lesson) => lesson.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ type: 'varchar', length: 64 })
  word: string;

  @Column({ type: 'varchar', length: 3 })
  guess: string;

  // The right article, so stats never need the word lists from the AI service.
  @Column({ type: 'varchar', length: 3 })
  article: string;

  @Column({ type: 'boolean' })
  correct: boolean;
}
