import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/transforms';
import { LEVELS, MODES } from '../user-settings.entity';

export class UpdateProfileDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 50)
  displayName?: string;

  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt only uses the first 72 bytes
  newPassword: string;
}

export class DeleteAccountDto {
  @IsString()
  password: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(MODES)
  mode?: (typeof MODES)[number];

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{1,32}$/, { message: 'voice must be a voice name' })
  voice?: string;

  @IsOptional()
  @IsIn(LEVELS)
  lessonLevel?: (typeof LEVELS)[number];

  @IsOptional()
  @IsIn(LEVELS)
  conversationLevel?: (typeof LEVELS)[number];
}
