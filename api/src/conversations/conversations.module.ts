import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScenarioCompletion } from './scenario-completion.entity';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScenarioCompletion])],
  providers: [ConversationsService],
  controllers: [ConversationsController],
})
export class ConversationsModule {}
