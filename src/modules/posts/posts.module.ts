import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { PollVote } from './entities/poll-vote.entity';
import { PostReaction } from './entities/post-reaction.entity';
import { ReactionEmoji } from './entities/reaction-emoji.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { StorageService } from '../../common/services/storage.service';
import { S3StorageService } from '../../common/services/s3-storage.service';
import { FileStorageService } from '../../common/services/file-storage.service';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReactionEmojiSeeder } from './reaction-emoji.seeder';

@Module({
    imports: [
        TypeOrmModule.forFeature([Post, PollVote, PostReaction, ReactionEmoji, Comment, CommentLike]),
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
    providers: [
        PostsService,
        StorageService,
        S3StorageService,
        FileStorageService,
        JwtAuthGuard,
        ReactionEmojiSeeder,
    ],
    exports: [PostsService],
})
export class PostsModule { }

