import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiService } from '../ai/ai.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  @Get()
  async health() {
    const db = await this.dataSource
      .query('SELECT 1')
      .then(() => true)
      .catch(() => false);
    return { status: db ? 'ok' : 'degraded', database: db, aiService: await this.ai.isUp() };
  }
}
