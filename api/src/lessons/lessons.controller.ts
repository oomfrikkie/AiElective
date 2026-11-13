import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { AiService } from '../ai/ai.service';
import { LessonsService } from './lessons.service';
import { ListLessonsQuery, StartLessonDto, SubmitLessonDto } from './dto/lesson.dto';

@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly ai: AiService,
  ) {}

  /** Levels that have a word list. Public, so the page can show them before login. */
  @Get('levels')
  levels() {
    return this.ai.levels();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  start(@CurrentUser() user: AuthUser, @Body() dto: StartLessonDto) {
    return this.lessons.start(user.id, dto.level);
  }

  @Post(':id/submit')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitLessonDto,
  ) {
    return this.lessons.submit(user.id, id, dto.answers);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthUser, @Query() query: ListLessonsQuery) {
    return this.lessons.list(user.id, query.level, query.limit);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  stats(@CurrentUser() user: AuthUser) {
    return this.lessons.stats(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessons.findOne(user.id, id);
  }
}
