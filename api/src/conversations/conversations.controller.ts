import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ConversationsService } from './conversations.service';
import { CreateCompletionDto } from './dto/completion.dto';

@Controller('conversations/completions')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  complete(@CurrentUser() user: AuthUser, @Body() dto: CreateCompletionDto) {
    return this.conversations.complete(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.conversations.list(user.id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.conversations.summary(user.id);
  }
}
