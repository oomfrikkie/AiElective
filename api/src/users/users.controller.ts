import { Body, Controller, Delete, Get, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';
import { toSettingsDto, toUserDto } from './dto/user.dto';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  UpdateProfileDto,
  UpdateSettingsDto,
} from './dto/update-user.dto';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() user: AuthUser) {
    return toUserDto(await this.users.findById(user.id));
  }

  @Patch()
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return toUserDto(await this.users.updateProfile(user.id, dto));
  }

  @Patch('password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.users.changePassword(user.id, dto);
  }

  @Get('settings')
  async getSettings(@CurrentUser() user: AuthUser) {
    return toSettingsDto((await this.users.findById(user.id)).settings);
  }

  @Patch('settings')
  async updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return toSettingsDto(await this.users.updateSettings(user.id, dto));
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto) {
    await this.users.remove(user.id, dto.password);
  }
}
