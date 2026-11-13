import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScenarioCompletion } from './scenario-completion.entity';
import { CreateCompletionDto } from './dto/completion.dto';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(ScenarioCompletion)
    private readonly completions: Repository<ScenarioCompletion>,
  ) {}

  async complete(userId: string, dto: CreateCompletionDto) {
    const saved = await this.completions.save(
      this.completions.create({ ...dto, corrections: dto.corrections ?? 0, userId }),
    );
    return this.toDto(saved);
  }

  async list(userId: string) {
    const rows = await this.completions.find({
      where: { userId },
      order: { completedAt: 'DESC' },
      take: 100,
    });
    return rows.map((r) => this.toDto(r));
  }

  /** Per scenario: how often it was finished and the best (fewest) turns. */
  async summary(userId: string) {
    return this.completions
      .createQueryBuilder('c')
      .select('c.level', 'level')
      .addSelect('c.scenario_id', 'scenarioId')
      .addSelect('MAX(c.scenario_title)', 'scenarioTitle')
      .addSelect('COUNT(*)::int', 'timesCompleted')
      .addSelect('MIN(c.turns)::int', 'bestTurns')
      .addSelect('MAX(c.completed_at)', 'lastCompletedAt')
      .where('c.user_id = :userId', { userId })
      .groupBy('c.level')
      .addGroupBy('c.scenario_id')
      .orderBy('c.level')
      .addOrderBy('"lastCompletedAt"', 'DESC')
      .getRawMany();
  }

  private toDto(c: ScenarioCompletion) {
    return {
      id: c.id,
      level: c.level,
      scenarioId: c.scenarioId,
      scenarioTitle: c.scenarioTitle,
      turns: c.turns,
      corrections: c.corrections,
      completedAt: c.completedAt,
    };
  }
}
