import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export const MODES = ['text', 'voice'] as const;
export const LEVELS = ['A1', 'A2', 'B1'] as const;
export type Mode = (typeof MODES)[number];
export type Level = (typeof LEVELS)[number];

// What used to live in the browser's localStorage, now kept per account so it follows
// the learner to any device.
@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 10, default: 'text' })
  mode: Mode;

  @Column({ type: 'varchar', length: 32, default: 'Kore' })
  voice: string;

  // Last level picked in the de/het lessons and in conversation practice.
  @Column({ name: 'lesson_level', type: 'varchar', length: 4, default: 'A1' })
  lessonLevel: Level;

  @Column({ name: 'conversation_level', type: 'varchar', length: 4, default: 'A1' })
  conversationLevel: Level;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
