import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { PollVote } from './entities/poll-vote.entity';
import { S3StorageService } from '../../common/services/s3-storage.service';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Post, PollVote]),
        ConfigModule,
        UsersModule,
        SessionModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (cfg: ConfigService) => ({
                secret: cfg.get('JWT_SECRET') || 'changeme',
                signOptions: { expiresIn: cfg.get('JWT_EXPIRES_IN') || '3600s' },
            }),
        }),
    ],
    controllers: [PostsController],
    providers: [PostsService, S3StorageService, JwtAuthGuard],
    exports: [PostsService],
})
export class PostsModule { }

