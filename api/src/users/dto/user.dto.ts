import { User } from '../user.entity';
import { UserSettings } from '../user-settings.entity';

export interface SettingsDto {
  mode: string;
  voice: string;
  lessonLevel: string;
  conversationLevel: string;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  settings: SettingsDto;
}

export function toSettingsDto(s: UserSettings): SettingsDto {
  return {
    mode: s.mode,
    voice: s.voice,
    lessonLevel: s.lessonLevel,
    conversationLevel: s.conversationLevel,
  };
}

// The only shape a user ever leaves the API in: no password hash, no internals.
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    settings: toSettingsDto(user.settings),
  };
}
