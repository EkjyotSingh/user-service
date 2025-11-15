import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto, SocialLoginDto } from './dto/login.dto';
import { AuthProvider } from './enums/auth-provider.enum';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;
    constructor(
        private users: UsersService,
        private jwt: JwtService,
        private config: ConfigService,
    ) {
        const gid = this.config.get<string>('GOOGLE_CLIENT_ID');
        if (!gid) {
            console.warn('GOOGLE_CLIENT_ID not configured - Google login will fail');
        }
        this.googleClient = new OAuth2Client(gid);
    }

    async login(dto: LoginDto) {
        switch (dto.type) {
            case AuthProvider.PHONE:
                // return this.loginWithPhone(dto.phone!);
                break;
            case AuthProvider.EMAIL:
                // return this.loginWithEmail(dto.email!, dto.password!);
                break;
            default:
                throw new UnauthorizedException('Unsupported provider');
        }
    }

    async socialLogin(dto: SocialLoginDto) {
        const { type, idToken } = dto;
        let providerId = null
        let email = null
        let emailVerified = false
        let name = null
        let picture = null

        if (type === AuthProvider.GOOGLE) {
            let ticket;
            try {
                ticket = await this.googleClient.verifyIdToken({
                    idToken,
                    audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
                });
            } catch (err) {
                console.debug('Google token verify failed', err);
                throw new UnauthorizedException('Invalid Google token');
            }

            const payload = ticket.getPayload();
            if (!payload) throw new UnauthorizedException('Invalid Google token payload');

            providerId = payload['sub'];
            email = payload['email'];
            emailVerified =
                payload['email_verified'] === 'true' || payload['email_verified'] === true;
            name = payload['name'] ?? null;
            picture = payload['picture'] ?? null;
        } else if (type === AuthProvider.APPLE) {

        }

        let user: User | null = null;
        if (providerId) {
            user = await this.users.findByProviderId(type, providerId);
        }
        if (!user) {
            user = await this.users.create({
                name,
                providerId,
                email: email ?? "",
                isEmailVerified: emailVerified,
                provider: 'google',
            } as any);
        } else {
            const updates: any = {};
            if (!user.providerId && providerId) updates.providerId = providerId;
            if (!user.isEmailVerified && emailVerified) updates.isEmailVerified = true;
            if (name && user.name !== name) updates.name = name;
            if (Object.keys(updates).length) await this.users.update(user.id, updates);

        }

    }

    //   private async loginWithPhone(phone: string) {
    //     let user = await this.users.findByPhone(phone);
    //     if (!user) {
    //       user = await this.users.create({ phone } as any);
    //       await this.users.update(user.id, { provider: 'phone' });
    //     }
    //     return this.signJwt(user);
    //   }

    //   private async loginWithEmail(email: string, password: string) {
    //     let user = await this.users.findByEmail(email);
    //     if (!user) {
    //       user = await this.users.create({ email, password: null } as any);
    //       await this.users.update(user.id, { provider: 'email_otp' });
    //     }
    //     return this.signJwt(user);
    //   }

    private signJwt(user: any) {
        const payload = { sub: user.id, email: user.email ?? null, provider: user.provider };
        const token = this.jwt.sign(payload);
        return { access_token: token };
    }
}
