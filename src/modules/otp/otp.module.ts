import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Otp } from './entities/otp.entity';
import { OtpProcessor } from '../../queue/processors/otp.processor';
import { TwilioService } from '../../common/services/twilio.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    UsersModule,
    TypeOrmModule.forFeature([Otp]),
    BullModule.registerQueue({
      name: 'otp',
    }),
  ],
  providers: [OtpService, OtpProcessor, TwilioService],
  controllers: [OtpController],
  exports: [OtpService],
})
export class OtpModule {}
