import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { toUserDto } from '../users/dto/user.dto';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.users.create(dto.email, dto.password, dto.displayName);
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.verifyCredentials(dto.email, dto.password);
    // Same message for unknown email and wrong password.
    if (!user) throw new UnauthorizedException('Email or password is incorrect');
    return this.session(user);
  }

  private async session(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return { accessToken: await this.jwt.signAsync(payload), user: toUserDto(user) };
  }
}
