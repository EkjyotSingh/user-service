import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AuthProvider } from '../auth/enums/auth-provider.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private dataSource: DataSource,
  ) {}

  findByPhone(phone: string) {
    return this.usersRepo.findOne({ where: { phone } });
  }

  findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }
  create(partial: Partial<User>) {
    const u = this.usersRepo.create(partial);
    return this.usersRepo.save(u);
  }
  update(id: string, partial: Partial<User>) {
    return this.usersRepo.update(id, partial);
  }

  // Example transactional create
  async createUserWithDefaults(partial: Partial<User>) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = repo.create(partial);
      return repo.save(user);
    });
  }

  async findByProviderId(provider: AuthProvider, providerId: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { provider, providerId } });
  }
}
