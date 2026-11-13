import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LEVELS } from '../../users/user-settings.entity';

export class StartLessonDto {
  @IsIn(LEVELS)
  level: (typeof LEVELS)[number];
}

export class AnswerDto {
  @IsString()
  @MaxLength(64)
  word: string;

  @IsIn(['de', 'het'])
  guess: 'de' | 'het';
}

export class SubmitLessonDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

export class ListLessonsQuery {
  @IsOptional()
  @IsIn(LEVELS)
  level?: (typeof LEVELS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
