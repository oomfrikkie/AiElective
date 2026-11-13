import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { Lesson } from './lesson.entity';
import { LessonAnswer } from './lesson-answer.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Lesson, LessonAnswer]), AiModule],
  providers: [LessonsService],
  controllers: [LessonsController],
})
export class LessonsModule {}
