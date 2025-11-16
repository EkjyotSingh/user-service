import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { AuthProvider } from '../auth/enums/auth-provider.enum';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private repo: Repository<User>,
    ) { }

    async findByProviderId(provider: AuthProvider, providerId: string): Promise<User | null> {
        return this.repo.findOne({ where: { provider, providerId } });
    }

    async create(data: Partial<User>): Promise<User> {
        const user = this.repo.create(data);
        return this.repo.save(user);
    }

    async update(id: string, data: Partial<User>): Promise<User | null> {
        await this.repo.update(id, data);
        return this.repo.findOne({ where: { id } });
    }
}
