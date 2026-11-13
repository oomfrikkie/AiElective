import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { LessonAnswer } from './lesson-answer.entity';

export type LessonStatus = 'in_progress' | 'completed';

export interface LessonWord {
  word: string;
  english: string;
}

export interface LessonMistake {
  word: string;
  article: string;
  english: string;
  guess: string;
  aiHint: string | null;
  teacherTip: string | null;
}

// One de/het lesson. Created 'in_progress' when the learner starts it (the words are stored
// so the answers can be checked against them) and 'completed' once it is graded.
@Entity('lessons')
@Index(['userId', 'level', 'status'])
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 4 })
  level: string;

  @Column({ type: 'varchar', length: 12, default: 'in_progress' })
  status: LessonStatus;

  @Column({ name: 'lesson_number', type: 'int' })
  lessonNumber: number;

  @Column({ type: 'jsonb' })
  groups: LessonWord[][];

  // Words the learner got wrong last time; they come back in this lesson.
  @Column({ name: 'last_wrong', type: 'jsonb', default: () => "'[]'" })
  lastWrong: string[];

  @Column({ type: 'int', nullable: true })
  score: number | null;

  @Column({ type: 'int' })
  total: number;

  // The AI feedback shown after grading, kept so a past lesson can be reviewed later.
  @Column({ type: 'jsonb', nullable: true })
  mistakes: LessonMistake[] | null;

  @OneToMany(() => LessonAnswer, (answer) => answer.lesson, { cascade: true })
  answers: LessonAnswer[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
