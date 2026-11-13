import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserSettings } from './user-settings.entity';
import { Lesson } from '../lessons/lesson.entity';
import { ScenarioCompletion } from '../conversations/scenario-completion.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Always stored lowercase (the DTOs normalise it), so the unique index is case-insensitive.
  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  @Column({ name: 'display_name', type: 'varchar', length: 50 })
  displayName: string;

  // Never selected unless asked for explicitly (login / password change).
  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  passwordHash: string;

  @OneToOne(() => UserSettings, (settings) => settings.user, { cascade: true })
  settings: UserSettings;

  @OneToMany(() => Lesson, (lesson) => lesson.user)
  lessons: Lesson[];

  @OneToMany(() => ScenarioCompletion, (completion) => completion.user)
  scenarioCompletions: ScenarioCompletion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
