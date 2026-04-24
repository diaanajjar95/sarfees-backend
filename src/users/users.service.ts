import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findByPhone(
    phoneNumber: string,
    countryCode: string,
  ): Promise<User | null> {
    return this.usersRepository.findOneBy({ phoneNumber, countryCode });
  }

  async create(phoneNumber: string, countryCode: string): Promise<User> {
    const user = this.usersRepository.create({ phoneNumber, countryCode });
    return this.usersRepository.save(user);
  }

  async update(id: number, attrs: Partial<User>) {
    await this.usersRepository.update(id, attrs);
    return this.findById(id);
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async completeProfile(
    userId: number,
    dto: CompleteProfileDto,
    photoPath?: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.firstName = dto.firstName;
    user.lastName = dto.lastName;
    user.gender = dto.gender;
    if (dto.email) {
      user.email = dto.email;
    }
    if (photoPath) {
      user.profilePhotoUrl = photoPath;
    }
    user.isProfileCompleted = true;

    try {
      return await this.usersRepository.save(user);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as any).code === '23505' &&
        (err as any).detail?.includes('email')
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw err;
    }
  }
}
