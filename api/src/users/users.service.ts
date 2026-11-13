import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserSettings } from './user-settings.entity';
import { ChangePasswordDto, UpdateProfileDto, UpdateSettingsDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 10;
// Compared against when an email is unknown, so a failed login always costs one bcrypt check.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserSettings) private readonly settings: Repository<UserSettings>,
  ) {}

  hashPassword(password: string) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async create(email: string, password: string, displayName: string): Promise<User> {
    if (await this.users.existsBy({ email })) {
      throw new ConflictException('An account with this email already exists');
    }
    const user = this.users.create({
      email,
      displayName,
      passwordHash: await this.hashPassword(password),
      settings: this.settings.create({}),
    });
    try {
      await this.users.save(user);
    } catch (e) {
      // Two sign-ups with the same email at the same moment: the unique index decides.
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('An account with this email already exists');
      }
      throw e;
    }
    return this.findById(user.id);
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id }, relations: { settings: true } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  exists(id: string) {
    return this.users.existsBy({ id });
  }

  /** The user with this email and password, or null. Takes the same time either way. */
  async verifyCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
    // Compare against a dummy hash when the email is unknown, so response times don't
    // reveal which emails have an account.
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);
    return user && ok ? this.findById(user.id) : null;
  }

  private async checkPassword(id: string, password: string) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Password is incorrect');
    }
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);
    if (dto.email && dto.email !== user.email && (await this.users.existsBy({ email: dto.email }))) {
      throw new ConflictException('An account with this email already exists');
    }
    await this.users.update(id, {
      ...(dto.displayName !== undefined && { displayName: dto.displayName }),
      ...(dto.email !== undefined && { email: dto.email }),
    });
    return this.findById(id);
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    await this.checkPassword(id, dto.currentPassword);
    await this.users.update(id, { passwordHash: await this.hashPassword(dto.newPassword) });
  }

  async updateSettings(id: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    await this.settings.update({ userId: id }, dto);
    return this.settings.findOneByOrFail({ userId: id });
  }

  async remove(id: string, password: string) {
    await this.checkPassword(id, password);
    // Settings, lessons, answers and completions go too (ON DELETE CASCADE).
    await this.users.delete(id);
  }
}
