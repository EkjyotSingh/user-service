import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UserSession } from '../session/entities/user-session.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { S3StorageService } from '../../common/services/s3-storage.service';
import { SessionModule } from '../session/session.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession]),
    ConfigModule,
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
  controllers: [UsersController],
  providers: [UsersService, S3StorageService, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule { }
