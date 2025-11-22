import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('join-community')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Join community',
    description: 'Update a single field for joining community. Only one field can be updated at a time: username, acceptGuidelines, or avatar.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          description: 'Username for the user (only provide this OR acceptGuidelines OR avatar)',
          example: 'chloentepreneur',
        },
        acceptGuidelines: {
          type: 'boolean',
          description: 'Whether the user has accepted the community guidelines (only provide this OR username OR avatar)',
          example: true,
          enum: [true],
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file (only provide this OR username OR acceptGuidelines)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Successfully updated field' })
  @ApiResponse({ status: 400, description: 'Invalid input or validation failed. Must provide exactly one field to update.' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async joinCommunity(
    @Body() body: any,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif|webp)/i }),
        ],
      }),
    )
    avatarFile?: any,
    @CurrentUser() user?: User,
  ) {
    return this.usersService.joinCommunity(user as User, {
      username: body?.username,
      acceptGuidelines: body?.acceptGuidelines,
      avatar: avatarFile || body?.avatar,
    });
  }
}
