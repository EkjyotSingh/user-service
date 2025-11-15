import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { AuthProvider } from './enums/auth-provider.enum';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
  }

  async login(dto: LoginDto) {
    switch (dto.type) {
      case AuthProvider.PHONE:
        // return this.loginWithPhone(dto.phone!);

      case AuthProvider.EMAIL:
        // return this.loginWithEmail(dto.email!, dto.password!);

      default:
        throw new UnauthorizedException('Unsupported provider');
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
