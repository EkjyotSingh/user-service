import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

@Injectable()
export class TwilioService implements OnModuleInit {
  private readonly logger = new Logger(TwilioService.name);
  private twilioClient: twilio.Twilio | null = null;
  private readonly fromPhoneNumber: string;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<string>('TWILIO_ENABLED') === 'true';
    this.fromPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';
  }

  onModuleInit() {
    if (this.isEnabled) {
      const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

      if (!accountSid || !authToken) {
        this.logger.warn(
          'Twilio credentials not found. SMS sending will be disabled. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.',
        );
        return;
      }

      if (!this.fromPhoneNumber) {
        this.logger.warn(
          'Twilio phone number not configured. Set TWILIO_PHONE_NUMBER in environment variables.',
        );
        return;
      }

      try {
        this.twilioClient = twilio(accountSid, authToken);
        this.logger.log('Twilio service initialized successfully');
      } catch (error) {
        this.logger.error('Failed to initialize Twilio client', error);
      }
    } else {
      this.logger.log('Twilio is disabled. Set TWILIO_ENABLED=true to enable SMS sending.');
    }
  }

  /**
   * Send OTP via SMS using Twilio
   */
  async sendOtpSms(phone: string, code: string, purpose: string): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn(
        `SMS sending is disabled. Would send OTP ${code} to ${phone} for ${purpose}`,
      );
      // Simulate SMS sending in development
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }

    if (!this.twilioClient) {
      throw new Error('Twilio client is not initialized. Check your configuration.');
    }

    // Format phone number (ensure it starts with +)
    const formattedPhone = this.formatPhoneNumber(phone);

    // Create OTP message based on purpose
    const message = this.createOtpMessage(code, purpose);

    try {
      const messageResponse = await this.twilioClient.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: formattedPhone,
      });

      this.logger.log(
        `OTP SMS sent successfully. SID: ${messageResponse.sid}, To: ${formattedPhone}`,
      );

      // Check if message was sent successfully
      if (messageResponse.status === 'failed' || messageResponse.errorCode) {
        const errorMsg = `Twilio error: ${messageResponse.errorMessage || 'Unknown error'} (Code: ${messageResponse.errorCode}, Status: ${messageResponse.status})`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      // Handle Twilio-specific errors
      let errorMessage = 'Failed to send SMS';

      if (error.code === 20003 || error.message?.includes('Authenticate')) {
        errorMessage =
          'Twilio authentication failed. Please check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct.';
        this.logger.error(
          `Twilio authentication error. Account SID configured: ${!!this.configService.get<string>('TWILIO_ACCOUNT_SID')}, Auth Token configured: ${!!this.configService.get<string>('TWILIO_AUTH_TOKEN')}`,
        );
      } else if (error.code === 21211) {
        errorMessage = `Invalid phone number format: ${formattedPhone}. Please ensure the phone number is in E.164 format.`;
      } else if (error.code === 21614) {
        errorMessage = `Invalid 'from' phone number: ${this.fromPhoneNumber}. Please verify your TWILIO_PHONE_NUMBER is correct and verified in Twilio.`;
      } else {
        errorMessage = error.message || 'Unknown error occurred';
      }

      this.logger.error(`Failed to send SMS to ${formattedPhone}: ${errorMessage}`, {
        errorCode: error.code,
        errorMessage: error.message,
        stack: error.stack,
        phone: formattedPhone,
        from: this.fromPhoneNumber,
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');

    // If phone already starts with +, return as is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // If phone doesn't start with +, we need to determine country code
    // For now, just add + and let Twilio validate
    // Note: This is a simplified approach. In production, you might want to use
    // a library like libphonenumber-js to properly format numbers
    if (!cleaned.startsWith('+')) {
      // Log warning if number format seems unusual
      this.logger.warn(
        `Phone number ${phone} doesn't have country code. Expected format: +[country code][number]`,
      );
      // Don't auto-add country code - let Twilio handle validation
      // This prevents issues with international numbers
      throw new Error(
        `Phone number must include country code. Received: ${phone}, Expected format: +[country code][number] (e.g., +917015935344 for India)`,
      );
    }

    return cleaned;
  }

  /**
   * Create OTP message based on purpose
   */
  private createOtpMessage(code: string, purpose: string): string {
    const purposeMessages: Record<string, string> = {
      login: `Your login code is: ${code}. This code will expire in ${this.configService.get<number>('OTP_TTL_MINUTES')} minutes.`,
      reset: `Your password reset code is: ${code}. This code will expire in ${this.configService.get<number>('OTP_TTL_MINUTES')} minutes.`,
      verify: `Your verification code is: ${code}. This code will expire in ${this.configService.get<number>('OTP_TTL_MINUTES')} minutes.`,
    };

    return (
      purposeMessages[purpose] ||
      `Your verification code is: ${code}. This code will expire in ${this.configService.get<number>('OTP_TTL_MINUTES')} minutes.`
    );
  }

  /**
   * Verify Twilio service is properly configured
   */
  isConfigured(): boolean {
    return this.isEnabled && this.twilioClient !== null && !!this.fromPhoneNumber;
  }
}
