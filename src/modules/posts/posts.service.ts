import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Post, PostType } from './entities/post.entity';
import { PollVote } from './entities/poll-vote.entity';
import { PostReaction } from './entities/post-reaction.entity';
import { ReactionEmoji } from './entities/reaction-emoji.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { VotePollDto } from './dto/vote-poll.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { StorageService } from '../../common/services/storage.service';
import { randomUUID } from 'crypto';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
    constructor(
        @InjectRepository(Post) private postsRepo: Repository<Post>,
        @InjectRepository(PollVote) private pollVotesRepo: Repository<PollVote>,
        @InjectRepository(PostReaction) private postReactionsRepo: Repository<PostReaction>,
        @InjectRepository(ReactionEmoji) private reactionEmojisRepo: Repository<ReactionEmoji>,
        @InjectRepository(Comment) private commentsRepo: Repository<Comment>,
        @InjectRepository(CommentLike) private commentLikesRepo: Repository<CommentLike>,
        private storageService: StorageService,
    ) { }

    async createPost(userId: string, dto: CreatePostDto, images?: any[]): Promise<Post> {
        const payload: Partial<Post> = {
            userId,
            content: dto.content,
            type: dto.type,
            category: dto.category,
        }
        if (dto.type === PostType.TEXT) {
            let imageUrls: string[] | undefined;
            if (images && images.length > 0) {
                const uploadedImages = await this.storageService.uploadFiles(images, 'posts');
                imageUrls = uploadedImages.map((img) => img.url);
            }
            payload.imageUrls = imageUrls ?? [];
        } else if (dto.type === PostType.POLL || dto.type === PostType.POLL_WITH_IMAGES) {
            payload.question = dto.question;
            payload.multipleSelection = dto.multipleSelection || false;
            payload.durationDays = dto.durationDays;

            // Calculate expiration date if duration is provided
            if (dto.durationDays) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + dto.durationDays);
                payload.expiresAt = expiresAt;
            }

            // const optionsText: string[] = dto?.optionsText?.split(',') ?? [];
            if (dto.type === PostType.POLL_WITH_IMAGES) {
                if (images && images.length > 0) {
                    const uploadedImages = await this.storageService.uploadFiles(images, 'polls');
                    // payload.pollOptions = uploadedImages.map((img, index) => {
                    //     return {
                    //         id: randomUUID(),
                    //         text: optionsText?.[index],
                    //         imageUrl: img.url,
                    //         voteCount: 0,
                    //     };
                    // });
                }
            } else {
                if (dto.optionsText && dto.optionsText.length > 0) {
                    // payload.pollOptions = optionsText.map((text) => {
                    //     return {
                    //         id: randomUUID(),
                    //         text,
                    //         voteCount: 0,
                    //     };
                    // });
                }
            }
        }
        const post = this.postsRepo.create(payload);
        const savedPost = await this.postsRepo.save(post);

        // Return with appropriate message based on post type
        const message =
            savedPost.type === PostType.POLL || savedPost.type === PostType.POLL_WITH_IMAGES
                ? 'Poll created successfully'
                : 'Post created successfully';

        return { ...savedPost, message } as any;
    }

    async votePoll(userId: string, dto: VotePollDto): Promise<Post> {
        const post = await this.postsRepo.findOne({ where: { id: dto.pollId, isDeleted: false } });

        if (!post) {
            throw new NotFoundException('Poll not found');
        }

        // Verify it's a poll
        if (post.type !== PostType.POLL && post.type !== PostType.POLL_WITH_IMAGES) {
            throw new BadRequestException('This post is not a poll');
        }

        if (!post.pollOptions || post.pollOptions.length === 0) {
            throw new BadRequestException('Poll has no options');
        }

        // Check if poll is closed
        if (post.isClosed) {
            throw new BadRequestException('Poll is closed');
        }

        // Check if poll has expired
        if (post.expiresAt && new Date() > post.expiresAt) {
            throw new BadRequestException('Poll has expired');
        }

        // Check if user already voted (for single selection polls)
        if (!post.multipleSelection) {
            const existingVote = await this.pollVotesRepo.findOne({
                where: { userId, postId: dto.pollId },
            });

            if (existingVote) {
                throw new BadRequestException('You have already voted on this poll');
            }

            // For single selection, only allow one option
            if (dto.optionIds.length > 1) {
                throw new BadRequestException('Only one option can be selected for this poll');
            }
        } else {
            // For multiple selection, check if any of the options were already voted on
            const existingVotes = await this.pollVotesRepo.find({
                where: { userId, postId: dto.pollId, optionId: In(dto.optionIds) },
            });

            if (existingVotes.length > 0) {
                throw new BadRequestException('You have already voted on some of these options');
            }
        }

        // Validate that all option IDs exist in the poll
        const validOptionIds = post.pollOptions.map((opt) => opt.id);
        const invalidOptions = dto.optionIds.filter((id) => !validOptionIds.includes(id));

        if (invalidOptions.length > 0) {
            throw new BadRequestException(`Invalid option IDs: ${invalidOptions.join(', ')}`);
        }

        // Create votes
        const votes = dto.optionIds.map((optionId) =>
            this.pollVotesRepo.create({
                userId,
                postId: dto.pollId,
                optionId,
            }),
        );

        await this.pollVotesRepo.save(votes);

        // Update vote counts in poll options
        dto.optionIds.forEach((optionId) => {
            const option = post.pollOptions!.find((opt) => opt.id === optionId);
            if (option) {
                option.voteCount += 1;
            }
        });

        post.totalVotes += dto.optionIds.length;
        await this.postsRepo.save(post);

        return { ...post, message: 'Vote recorded successfully' } as any;
    }

    async getPosts(category?: string, limit: number = 20, offset: number = 0, userId?: string): Promise<any[]> {
        const queryBuilder = this.postsRepo
            .createQueryBuilder('post')
            .where('post.isDeleted = :isDeleted', { isDeleted: false })
            .orderBy('post.createdAt', 'DESC')
            .take(limit)
            .skip(offset);

        if (category) {
            queryBuilder.andWhere('post.category = :category', { category });
        }

        const posts = await queryBuilder.getMany();

        // If user is authenticated, fetch their votes for polls and likes for all posts
        if (userId) {
            const postIds = posts.map((post) => post.id);

            // Fetch user votes for polls
            const pollPosts = posts.filter(
                (post) => post.type === PostType.POLL || post.type === PostType.POLL_WITH_IMAGES,
            );

            const votesMap = new Map<string, string[]>();
            if (pollPosts.length > 0) {
                const pollIds = pollPosts.map((post) => post.id);
                const userVotes = await this.pollVotesRepo.find({
                    where: { userId, postId: In(pollIds) },
                });

                userVotes.forEach((vote) => {
                    if (!votesMap.has(vote.postId)) {
                        votesMap.set(vote.postId, []);
                    }
                    votesMap.get(vote.postId)!.push(vote.optionId);
                });
            }

            // Fetch user reactions for all posts
            const userReactions = await this.postReactionsRepo.find({
                where: { userId, postId: In(postIds) },
                relations: ['emoji'],
            });

            // Group reactions by postId
            const reactionsByPost = new Map<string, any[]>();
            userReactions.forEach((reaction) => {
                if (!reactionsByPost.has(reaction.postId)) {
                    reactionsByPost.set(reaction.postId, []);
                }
                reactionsByPost.get(reaction.postId)!.push({
                    emojiId: reaction.emojiId,
                    emojiCode: reaction.emoji.code,
                    emojiName: reaction.emoji.name,
                });
            });

            // Attach vote and reaction information to posts
            return posts.map((post) => {
                const postObj = post as any;

                // Add poll vote information
                if (post.type === PostType.POLL || post.type === PostType.POLL_WITH_IMAGES) {
                    const votedOptionIds = votesMap.get(post.id) || [];
                    postObj.userVotedOptionIds = votedOptionIds;
                    postObj.hasVoted = votedOptionIds.length > 0;
                }

                // Add reaction information
                postObj.userReactions = reactionsByPost.get(post.id) || [];

                return postObj;
            });
        }

        return posts;
    }

    async getPostById(id: string, userId?: string): Promise<any> {
        const post = await this.postsRepo.findOne({ where: { id, isDeleted: false } });

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        const postObj = { ...post } as any;

        // If user is authenticated, include vote and like information
        if (userId) {
            // Check if it's a poll and get vote information
            if (post.type === PostType.POLL || post.type === PostType.POLL_WITH_IMAGES) {
                const userVotes = await this.pollVotesRepo.find({
                    where: { userId, postId: id },
                });
                const votedOptionIds = userVotes.map((vote) => vote.optionId);
                postObj.userVotedOptionIds = votedOptionIds;
                postObj.hasVoted = votedOptionIds.length > 0;
            }

            // Check if user has reacted to the post
            const userReactions = await this.postReactionsRepo.find({
                where: { userId, postId: id },
                relations: ['emoji'],
            });
            postObj.userReactions = userReactions.map((reaction) => ({
                emojiId: reaction.emojiId,
                emojiCode: reaction.emoji.code,
                emojiName: reaction.emoji.name,
            }));
        }

        return postObj;
    }

    async getUserVote(userId: string, postId: string): Promise<PollVote[]> {
        return this.pollVotesRepo.find({ where: { userId, postId } });
    }

    async reactToPost(userId: string, postId: string, emojiId: string): Promise<any> {
        const post = await this.postsRepo.findOne({ where: { id: postId, isDeleted: false } });

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        // Verify emoji exists and is active
        const emoji = await this.reactionEmojisRepo.findOne({
            where: { id: emojiId, isActive: true },
        });

        if (!emoji) {
            throw new BadRequestException('Invalid or inactive reaction emoji');
        }

        // Check if user already reacted with this emoji
        const existingReaction = await this.postReactionsRepo.findOne({
            where: { userId, postId },
        });

        if (existingReaction) {
            if (existingReaction.emojiId === emojiId) {
                await this.postReactionsRepo.remove(existingReaction);
                post.reactionCount = Math.max(0, post.reactionCount - 1);
                await this.postsRepo.save(post);
                return { ...post, message: 'Reaction removed successfully', reacted: false } as any;
            } else {
                await this.postReactionsRepo.update(existingReaction.id, { emojiId });
                return { ...post, message: 'Reaction updated successfully', reacted: true } as any;
            }

        } else {
            // Create reaction
            const reaction = this.postReactionsRepo.create({
                userId,
                postId,
                emojiId,
            });
            await this.postReactionsRepo.save(reaction);

            // Update reaction count
            post.reactionCount += 1;
            await this.postsRepo.save(post);

            return {
                ...post,
                message: 'Reaction added successfully',
                reacted: true,
                emoji: {
                    id: emoji.id,
                    code: emoji.code,
                    name: emoji.name,
                },
            } as any;
        }
    }

    async deletePost(userId: string, postId: string): Promise<{ message: string }> {
        const post = await this.postsRepo.findOne({ where: { id: postId, isDeleted: false } });

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        // Check if user is the owner of the post
        if (post.userId !== userId) {
            throw new BadRequestException('You can only delete your own posts');
        }

        // Soft delete the post
        post.isDeleted = true;
        await this.postsRepo.save(post);

        return { message: 'Post deleted successfully' };
    }

    async getReactionEmojis(): Promise<ReactionEmoji[]> {
        return this.reactionEmojisRepo.find({
            where: { isActive: true },
            order: { displayOrder: 'ASC' },
        });
    }

    /**
     * Calculate the nesting level of a comment
     * Level 1: Direct comment on post (parentCommentId is null)
     * Level 2: Reply to a level 1 comment
     * Level 3: Reply to a level 2 comment
     */
    private async getCommentLevel(commentId: string): Promise<number> {
        let level = 1;
        let currentCommentId: string | null = commentId;

        while (currentCommentId) {
            const comment = await this.commentsRepo.findOne({
                where: { id: currentCommentId },
                select: ['parentCommentId'],
            });

            if (!comment || !comment.parentCommentId) {
                break;
            }

            level++;
            currentCommentId = comment.parentCommentId;

            // Safety check: prevent infinite loops
            if (level > 3) {
                break;
            }
        }

        return level;
    }

    async createComment(userId: string, dto: CreateCommentDto, postId: string): Promise<any> {
        // Verify post exists
        const post = await this.postsRepo.findOne({
            where: { id: postId, isDeleted: false },
        });

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        // If parent comment is provided, validate it
        if (dto.parentCommentId) {
            const parentComment = await this.commentsRepo.findOne({
                where: { id: dto.parentCommentId, isDeleted: false },
            });

            if (!parentComment) {
                throw new NotFoundException('Parent comment not found');
            }

            // Verify parent comment belongs to the same post
            if (parentComment.postId !== postId) {
                throw new BadRequestException('Parent comment does not belong to this post');
            }

            // Check nesting level - ensure we don't exceed 3 levels
            const parentLevel = await this.getCommentLevel(dto.parentCommentId);
            if (parentLevel >= 3) {
                throw new BadRequestException('Maximum nesting level (3) reached. Cannot reply to this comment.');
            }
        }

        // Create comment
        const comment = this.commentsRepo.create({
            postId: postId,
            userId,
            content: dto.content,
            parentCommentId: dto.parentCommentId,
        });

        const savedComment = await this.commentsRepo.save(comment);

        // Update comment count on post
        post.commentCount += 1;
        await this.postsRepo.save(post);

        return { ...savedComment, message: 'Comment created successfully' } as any;
    }

    async getComments(postId: string, userId?: string): Promise<any[]> {
        // Verify post exists
        const post = await this.postsRepo.findOne({
            where: { id: postId, isDeleted: false },
        });

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        // Get only top-level comments (no parent)
        const comments = await this.commentsRepo.find({
            where: { postId, parentCommentId: IsNull(), isDeleted: false },
            relations: ['user'],
            order: { createdAt: 'ASC' },
        });

        // Fetch user likes for comments if authenticated
        const likedCommentIds = new Set<string>();
        if (userId && comments.length > 0) {
            const commentIds = comments.map((c) => c.id);
            const userLikes = await this.commentLikesRepo.find({
                where: { userId, commentId: In(commentIds) },
            });
            userLikes.forEach((like) => likedCommentIds.add(like.commentId));
        }

        // Map comments to response format
        return comments.map((comment) => ({
            id: comment.id,
            postId: comment.postId,
            userId: comment.userId,
            user: {
                id: comment.user.id,
                username: comment.user.username,
                firstName: comment.user.firstName,
                lastName: comment.user.lastName,
                avatar: comment.user.avatar,
            },
            content: comment.content,
            likeCount: comment.likeCount,
            isLiked: likedCommentIds.has(comment.id),
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
        }));
    }

    async getCommentReplies(commentId: string, userId?: string): Promise<any[]> {
        // Verify comment exists
        const comment = await this.commentsRepo.findOne({
            where: { id: commentId, isDeleted: false },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        // Get direct replies to this comment (only one level)
        const replies = await this.commentsRepo.find({
            where: { parentCommentId: commentId, isDeleted: false },
            relations: ['user'],
            order: { createdAt: 'ASC' },
        });

        // Fetch user likes for replies if authenticated
        const likedCommentIds = new Set<string>();
        if (userId && replies.length > 0) {
            const replyIds = replies.map((r) => r.id);
            const userLikes = await this.commentLikesRepo.find({
                where: { userId, commentId: In(replyIds) },
            });
            userLikes.forEach((like) => likedCommentIds.add(like.commentId));
        }

        // Map replies to response format
        return replies.map((reply) => ({
            id: reply.id,
            postId: reply.postId,
            userId: reply.userId,
            user: {
                id: reply.user.id,
                username: reply.user.username,
                firstName: reply.user.firstName,
                lastName: reply.user.lastName,
                avatar: reply.user.avatar,
            },
            parentCommentId: reply.parentCommentId,
            content: reply.content,
            likeCount: reply.likeCount,
            isLiked: likedCommentIds.has(reply.id),
            createdAt: reply.createdAt,
            updatedAt: reply.updatedAt,
        }));
    }

    async likeComment(userId: string, commentId: string): Promise<any> {
        const comment = await this.commentsRepo.findOne({
            where: { id: commentId, isDeleted: false },
        });

        if (!comment) {
            throw new NotFoundException('Comment not found');
        }

        // Check if user already liked the comment
        const existingLike = await this.commentLikesRepo.findOne({
            where: { userId, commentId },
        });

        if (existingLike) {
            // Remove like
            await this.commentLikesRepo.remove(existingLike);

            // Update like count (ensure it doesn't go below 0)
            comment.likeCount = Math.max(0, comment.likeCount - 1);
            await this.commentsRepo.save(comment);

            return { ...comment, message: 'Comment unliked successfully', isLiked: false } as any;
        } else {
            // Create like
            const like = this.commentLikesRepo.create({
                userId,
                commentId,
            });
            await this.commentLikesRepo.save(like);

            // Update like count
            comment.likeCount += 1;
            await this.commentsRepo.save(comment);

            return { ...comment, message: 'Comment liked successfully', isLiked: true } as any;
        }
    }
}

