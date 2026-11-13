import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { Trim } from '../../common/transforms';
import { LEVELS } from '../../users/user-settings.entity';

export class CreateCompletionDto {
  @IsIn(LEVELS)
  level: (typeof LEVELS)[number];

  @IsString()
  @Matches(/^[a-z0-9-]{1,64}$/, { message: 'scenarioId must be a scenario id' })
  scenarioId: string;

  @Trim()
  @IsString()
  @Length(1, 120)
  scenarioTitle: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  turns: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(500)
  corrections?: number;
}
