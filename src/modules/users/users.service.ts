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
}
