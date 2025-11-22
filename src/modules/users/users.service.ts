import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AuthProvider } from '../auth/enums/auth-provider.enum';
import { S3StorageService } from '../../common/services/s3-storage.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private dataSource: DataSource,
    private s3StorageService: S3StorageService,
  ) { }

  findByPhone(phone: string) {
    return this.usersRepo.findOne({ where: { phone } });
  }

  findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }

  findByUsername(username: string) {
    return this.usersRepo.findOne({ where: { username } });
  }

  findByEmailWithPassword(email: string) {
    return this.usersRepo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.password')
      .getOne();
  }
  create(partial: Partial<User>) {
    const u = this.usersRepo.create(partial);
    return this.usersRepo.save(u);
  }
  update(id: string, partial: Partial<User>) {
    return this.usersRepo.update(id, partial);
  }

  async findByProviderId(provider: AuthProvider, providerId: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { provider, providerId } });
  }

  async joinCommunity(
    user: User,
    data: {
      username?: string;
      acceptGuidelines?: boolean;
      avatar?: any; // Can be file object or string URL
    },
  ): Promise<User> {
    // Determine which field is being updated
    const hasUsername = data?.username?.trim();
    const hasAcceptGuidelines = Boolean(data?.acceptGuidelines);

    const hasAvatar = data?.avatar && data.avatar !== undefined && data.avatar !== null;

    // Count how many fields are provided
    const fieldCount = [hasUsername, hasAcceptGuidelines, hasAvatar].filter(Boolean).length;

    if (fieldCount == 0) {
      throw new BadRequestException(
        'You must provide at least one field: username, acceptGuidelines, or avatar',
      );
    }

    if (hasUsername) {
      if (user.username) {
        throw new BadRequestException('Username already set');
      }

      // Username must always be the first step
      if (user.guidelinesAcceptedAt || user.avatar) {
        throw new BadRequestException('Username must be completed before guidelines or avatar');
      }

      const existing = await this.findByUsername(hasUsername);
      if (existing && existing.id !== user.id) {
        throw new ConflictException('This username is already taken. Please enter a different username.');
      }

      await this.usersRepo.update(user.id, { username: hasUsername });
    } else if (hasAcceptGuidelines) {
      if (user.guidelinesAcceptedAt) {
        throw new BadRequestException('Guidelines already accepted');
      }

      // must complete username first
      if (!user.username) {
        throw new BadRequestException('You must set your username before accepting guidelines');
      }

      await this.usersRepo.update(user.id, { guidelinesAcceptedAt: new Date() });
    } else if (hasAvatar) {
      // Handle avatar update
      if (hasAvatar) {
        if (user.avatar) {
          throw new BadRequestException('Avatar already uploaded');
        }

        // must complete username + guidelines first
        if (!user.username || !user.guidelinesAcceptedAt) {
          throw new BadRequestException('You must complete username and guidelines before avatar');
        }
        let avatarUrl: string;
        // Check if avatar is a file object (has buffer property) or a string
        if (data.avatar && typeof data.avatar === 'object' && 'buffer' in data.avatar) {
          // Upload file to S3
          const { url } = await this.s3StorageService.uploadFile(data.avatar, 'avatars');
          avatarUrl = url;
        } else if (typeof data.avatar === 'string') {
          // Use provided string (URL or avatar ID)
          avatarUrl = data.avatar;
        } else {
          throw new BadRequestException('Invalid avatar format');
        }
        await this.usersRepo.update(user.id, { avatar: avatarUrl });
      }
    }


    const updatedUser = await this.findById(user.id);
    if (!updatedUser) {
      throw new NotFoundException('User not found after update');
    }
    return updatedUser;
  }
}
