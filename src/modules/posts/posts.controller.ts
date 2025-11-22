import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFiles,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Query,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
    ApiBody,
    ApiQuery,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostOrPollDto } from './dto/create-post-or-poll.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
    constructor(private readonly postsService: PostsService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @UseInterceptors(
        AnyFilesInterceptor({
            storage: memoryStorage(),
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB per file
                files: 30, // Max 30 files (for multiple post images + option images)
            },
        }),
    )
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Create a new post or poll',
        description: `Create a post or poll. 
        - For regular posts: provide content and/or images field(s)
        - For polls: provide question and options (JSON string), optionally with option_<index>_image files for option images
        The API will automatically detect if it's a post or poll based on whether question and options are provided.`,
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                    description: 'Post content/text (required for posts, optional for polls)',
                    example: 'Excited to share my latest project!',
                },
                category: {
                    type: 'string',
                    description: 'Category for the post/poll',
                    example: 'Finance',
                },
                images: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                    description: 'Image files for regular posts (optional)',
                },
                question: {
                    type: 'string',
                    description: 'Poll question (required for polls)',
                    example: 'What matters most to you when using an app?',
                },
                options: {
                    type: 'string',
                    description: 'JSON string of poll options array (required for polls, minimum 2)',
                    example: JSON.stringify([
                        { text: 'Option 1' },
                        { text: 'Option 2' },
                    ]),
                },
                multipleSelection: {
                    type: 'boolean',
                    description: 'Whether users can select multiple options (for polls)',
                    example: false,
                },
                durationDays: {
                    type: 'number',
                    description: 'Poll duration in days (for polls, 1-365)',
                    example: 7,
                },
                option_0_image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image for poll option at index 0 (format: option_<index>_image)',
                },
                option_1_image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image for poll option at index 1',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Post or poll created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async createPostOrPoll(
        @Body('options') optionsJson?: string,
        @Body() body: any = {},
        @UploadedFiles() files?: any[],
        @CurrentUser() user?: User,
    ) {
        if (!user?.id) {
            throw new BadRequestException('User not found');
        }

        // Determine if it's a poll (has question and options) or a regular post
        const isPoll = body.question && optionsJson;

        if (isPoll) {
            // Handle poll creation
            let options: any[];
            try {
                options = typeof optionsJson === 'string' ? JSON.parse(optionsJson) : optionsJson || [];
            } catch (error) {
                throw new BadRequestException('Invalid JSON format for options');
            }

            // Match files to options based on field names (format: option_<index>_image)
            const optionImages: { [index: number]: any } = {};

            if (files && files.length > 0) {
                files.forEach((file) => {
                    const match = file.fieldname?.match(/^option_(\d+)_image$/);
                    if (match) {
                        const index = parseInt(match[1], 10);
                        optionImages[index] = file;
                    }
                });
            }

            const dto: any = {
                content: body.content,
                question: body.question,
                options,
                multipleSelection: body.multipleSelection === 'true' || body.multipleSelection === true,
                durationDays: body.durationDays ? Number(body.durationDays) : undefined,
                category: body.category,
            };

            return this.postsService.createPoll(user.id, dto, optionImages);
        } else {
            // Handle regular post creation
            // Separate post images from any other files
            const postImages = files?.filter((file) => {
                return file.fieldname === 'images' || (!file.fieldname?.startsWith('option_') && !file.fieldname?.includes('_image'));
            }) || [];

            const dto: any = {
                content: body.content,
                category: body.category,
            };

            return this.postsService.createPost(user.id, dto, postImages.length > 0 ? postImages : undefined);
        }
    }

    @Post('poll/vote')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Vote on a poll',
        description: 'Vote on a poll. For single selection polls, provide one optionId. For multiple selection polls, provide an array of optionIds.',
    })
    @ApiBody({ type: VotePollDto })
    @ApiResponse({ status: 200, description: 'Vote recorded successfully' })
    @ApiResponse({ status: 400, description: 'Invalid vote or poll restrictions' })
    @ApiResponse({ status: 404, description: 'Poll not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async votePoll(@Body() dto: VotePollDto, @CurrentUser() user?: User) {
        if (!user?.id) {
            throw new BadRequestException('User not found');
        }

        return this.postsService.votePoll(user.id, dto);
    }

    @Get()
    @ApiOperation({
        summary: 'Get posts',
        description: 'Get all posts, optionally filtered by category',
    })
    @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of posts to return (default: 20)' })
    @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of posts to skip (default: 0)' })
    @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
    async getPosts(
        @Query('category') category?: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ) {
        return this.postsService.getPosts(category, limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
    }

    @Get('poll')
    @ApiOperation({
        summary: 'Get polls',
        description: 'Get all active polls, optionally filtered by category',
    })
    @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of polls to return (default: 20)' })
    @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of polls to skip (default: 0)' })
    @ApiResponse({ status: 200, description: 'Polls retrieved successfully' })
    async getPolls(
        @Query('category') category?: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ) {
        return this.postsService.getPolls(category, limit ? Number(limit) : undefined, offset ? Number(offset) : undefined);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get post by ID',
        description: 'Get a specific post by ID',
    })
    @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    async getPostById(@Param('id') id: string) {
        return this.postsService.getPostById(id);
    }

    @Get('poll/:id')
    @ApiOperation({
        summary: 'Get poll by ID',
        description: 'Get a specific poll by ID',
    })
    @ApiResponse({ status: 200, description: 'Poll retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Poll not found' })
    async getPollById(@Param('id') id: string) {
        return this.postsService.getPollById(id);
    }
}

