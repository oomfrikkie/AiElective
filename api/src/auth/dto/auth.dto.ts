import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/transforms';

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt only uses the first 72 bytes
  password: string;

  @Trim()
  @IsString()
  @Length(1, 50)
  displayName: string;
}

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}
