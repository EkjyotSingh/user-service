import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    UseGuards,
    UseInterceptors,
    UploadedFiles,
    Query,
    BadRequestException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
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
import { VotePollDto } from './dto/vote-poll.dto';
import { ReactToPostDto } from './dto/react-to-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { LikeCommentDto } from './dto/like-comment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { PostType } from './entities/post.entity';

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
    @ApiBody({ type: CreatePostDto })
    @ApiOperation({
        summary: 'Create a new post or poll',
        description: `Create a post or poll. 
        - For regular posts: provide content and/or images field(s)
        - For polls: provide question and options (JSON string), optionally with option_<index>_image files for option images
        The API will automatically detect if it's a post or poll based on whether question and options are provided.`,
    })
    @ApiResponse({ status: 201, description: 'Post or poll created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async createPostOrPoll(
        @Body() body: CreatePostDto,
        @UploadedFiles() files?: any[],
        @CurrentUser() user?: User,
    ) {
        let images: any[] = [];
        let optionImages: any[] = [];
        for (const file of files || []) {
            if (file.fieldname === 'images') {
                images.push(file);
            } else if (file.fieldname === 'optionImages') {
                optionImages.push(file);
            }
        }
        return this.postsService.createPost(user?.id!, body, body.type === PostType.TEXT ? images : optionImages);
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
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get posts',
        description: 'Get all posts, optionally filtered by category. If authenticated, includes user vote information for polls. Authentication is optional.',
    })
    @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of posts to return (default: 20)' })
    @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of posts to skip (default: 0)' })
    @ApiResponse({
        status: 200,
        description: 'Posts retrieved successfully. For polls, if authenticated, includes userVotedOptionIds and hasVoted fields.',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['text', 'poll', 'poll_with_images'] },
                    content: { type: 'string' },
                    question: { type: 'string', description: 'For polls only' },
                    pollOptions: {
                        type: 'array',
                        description: 'For polls only',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                text: { type: 'string' },
                                imageUrl: { type: 'string' },
                                voteCount: { type: 'number' },
                            },
                        },
                    },
                    userVotedOptionIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of option IDs the user voted for (only present if authenticated and user has voted)',
                    },
                    hasVoted: {
                        type: 'boolean',
                        description: 'Whether the user has voted on this poll (only present if authenticated)',
                    },
                },
            },
        },
    })
    async getPosts(
        @Query('category') category?: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
        @CurrentUser() user?: User,
    ) {
        return this.postsService.getPosts(
            category,
            limit ? Number(limit) : undefined,
            offset ? Number(offset) : undefined,
            user?.id,
        );
    }

    @Get('reactions/emojis')
    @ApiOperation({
        summary: 'Get all available reaction emojis',
        description: 'Get a list of all active reaction emojis that can be used to react to posts.',
    })
    @ApiResponse({ status: 200, description: 'Reaction emojis retrieved successfully' })
    async getReactionEmojis() {
        return this.postsService.getReactionEmojis();
    }

    @Get('comments/:commentId/replies')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get replies for a specific comment',
        description: 'Get direct replies to a specific comment (only one level). Use this endpoint to load replies on demand.',
    })
    @ApiResponse({ status: 200, description: 'Replies retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Comment not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getCommentReplies(@Param('commentId') commentId: string, @CurrentUser() user?: User) {
        return this.postsService.getCommentReplies(commentId, user?.id);
    }

    @Get(':postId/comments')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get all top-level comments for a post',
        description: 'Get all top-level comments for a post (no replies). Use the replies endpoint to get replies for a specific comment.',
    })
    @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getComments(@Param('postId') postId: string, @CurrentUser() user?: User) {
        return this.postsService.getComments(postId, user?.id);
    }

    @Post('react')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'React to a post or poll',
        description: 'Add or remove a reaction (emoji) to a post or poll. If the same emoji is already applied, it will be removed (toggle).',
    })
    @ApiBody({ type: ReactToPostDto })
    @ApiResponse({ status: 200, description: 'Reaction added or removed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid emoji or request' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async reactToPost(@Body() dto: ReactToPostDto, @CurrentUser() user?: User) {
        if (!user?.id) {
            throw new BadRequestException('User not found');
        }

        return this.postsService.reactToPost(user.id, dto.postId, dto.emojiId);
    }

    @Post(':postId/comments')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Create a comment on a post',
        description: 'Create a comment on a post. Can be a top-level comment or a reply to another comment (up to 3 levels of nesting).',
    })
    @ApiBody({ type: CreateCommentDto })
    @ApiResponse({ status: 201, description: 'Comment created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input or maximum nesting level reached' })
    @ApiResponse({ status: 404, description: 'Post or parent comment not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async createComment(
        @Param('postId') postId: string,
        @Body() dto: CreateCommentDto,
        @CurrentUser() user?: User,
    ) {
        if (!user?.id) {
            throw new BadRequestException('User not found');
        }

        return this.postsService.createComment(user.id, dto, postId);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get post by ID',
        description: 'Get a specific post by ID',
    })
    @ApiResponse({ status: 200, description: 'Post retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getPostById(@Param('id') id: string, @CurrentUser() user?: User) {
        return this.postsService.getPostById(id, user?.id);
    }

    @Post('comments/like')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Like or unlike a comment',
        description: 'Like or unlike a comment. If already liked, it will be unliked (toggle).',
    })
    @ApiBody({ type: LikeCommentDto })
    @ApiResponse({ status: 200, description: 'Comment liked/unliked successfully' })
    @ApiResponse({ status: 404, description: 'Comment not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async likeComment(@Body() dto: LikeCommentDto, @CurrentUser() user?: User) {
        if (!user?.id) {
            throw new BadRequestException('User not found');
        }

        return this.postsService.likeComment(user.id, dto.commentId);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Delete a post or poll',
        description: 'Soft delete a post or poll. Only the post owner can delete their own posts.',
    })
    @ApiResponse({ status: 200, description: 'Post deleted successfully' })
    @ApiResponse({ status: 400, description: 'You can only delete your own posts' })
    @ApiResponse({ status: 404, description: 'Post not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async deletePost(@Param('id') id: string, @CurrentUser() user?: User) {
        if (!user?.id) {
            throw new BadRequestException('User not found');
        }

        return this.postsService.deletePost(user.id, id);
    }
}

