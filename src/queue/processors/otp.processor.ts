import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { OtpService } from '../../modules/otp/otp.service';
import { TwilioService } from '../../common/services/twilio.service';

export interface OtpJobData {
  email?: string;
  phone?: string;
  code: string;
  purpose: 'login' | 'reset' | 'verify';
  userId: string;
  otpId: string;
}

@Processor('otp')
@Injectable()
export class OtpProcessor extends WorkerHost {
  private readonly logger = new Logger(OtpProcessor.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly twilioService: TwilioService,
  ) {
    super();
  }

  async process(job: Job<OtpJobData>): Promise<void> {
    const { email, phone, code, purpose, otpId } = job.data;

    try {
      if (email) {
        // Send OTP via email
        await this.sendEmailOtp(email, code, purpose);
        this.logger.log(`OTP sent via email to ${email} for purpose: ${purpose}`);
      } else if (phone) {
        // Send OTP via SMS
        await this.sendSmsOtp(phone, code, purpose);
        this.logger.log(`OTP sent via SMS to ${phone} for purpose: ${purpose}`);
      } else {
        throw new Error('Either email or phone must be provided');
      }
    } catch (error) {
      this.logger.error(`Failed to send OTP for job ${job.id}: ${error.message}`, error.stack);

      // Invalidate OTP if sending fails after all retries
      if (job.attemptsMade >= (job.opts?.attempts || 3) - 1) {
        await this.otpService.invalidateOtp(otpId);
        this.logger.warn(`OTP ${otpId} invalidated due to send failure`);
      }

      throw error; // Re-throw to trigger retry mechanism
    }
  }

  /**
   * Send OTP via email
   * TODO: Integrate with your email service (e.g., SendGrid, SES, etc.)
   */
  private async sendEmailOtp(email: string, code: string, purpose: string): Promise<void> {
    // TODO: Replace with actual email service integration
    // Example:
    // await this.emailService.send({
    //   to: email,
    //   subject: `Your ${purpose} OTP`,
    //   template: 'otp',
    //   context: { code, purpose },
    // });

    // For now, just log (remove in production)
    console.log(`[EMAIL OTP] To: ${email}, Code: ${code}, Purpose: ${purpose}`);

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Send OTP via SMS using Twilio
   */
  private async sendSmsOtp(phone: string, code: string, purpose: string): Promise<void> {
    await this.twilioService.sendOtpSms(phone, code, purpose);
  }
}
