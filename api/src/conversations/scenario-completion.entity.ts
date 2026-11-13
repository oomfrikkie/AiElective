import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

// A conversation practice scenario the learner finished (goal reached + said goodbye).
@Entity('scenario_completions')
@Index(['userId', 'level', 'scenarioId'])
export class ScenarioCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (user) => user.scenarioCompletions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 4 })
  level: string;

  @Column({ name: 'scenario_id', type: 'varchar', length: 64 })
  scenarioId: string;

  @Column({ name: 'scenario_title', type: 'varchar', length: 120 })
  scenarioTitle: string;

  // How many messages the learner needed, a rough measure of fluency.
  @Column({ type: 'int' })
  turns: number;

  // How many of those messages needed a correction.
  @Column({ type: 'int', default: 0 })
  corrections: number;

  @CreateDateColumn({ name: 'completed_at', type: 'timestamptz' })
  completedAt: Date;
}
