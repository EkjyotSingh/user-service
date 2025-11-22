import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Post, PostType, PollOption } from './entities/post.entity';
import { PollVote } from './entities/poll-vote.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CreatePollDto, PollOptionDto } from './dto/create-poll.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { S3StorageService } from '../../common/services/s3-storage.service';
import { randomUUID } from 'crypto';

@Injectable()
export class PostsService {
    constructor(
        @InjectRepository(Post) private postsRepo: Repository<Post>,
        @InjectRepository(PollVote) private pollVotesRepo: Repository<PollVote>,
        private s3StorageService: S3StorageService,
    ) { }

    async createPost(userId: string, dto: CreatePostDto, images?: any[]): Promise<Post> {
        let imageUrls: string[] | undefined;

        // Upload images if provided
        if (images && images.length > 0) {
            const uploadedImages = await this.s3StorageService.uploadFiles(images, 'posts');
            imageUrls = uploadedImages.map((img) => img.url);
        }

        // Validate that post has at least content or images
        if (!dto.content && (!imageUrls || imageUrls.length === 0)) {
            throw new BadRequestException('Post must have either content or images');
        }

        const postType = imageUrls && imageUrls.length > 0 ? PostType.TEXT_WITH_IMAGES : PostType.TEXT;

        const post = this.postsRepo.create({
            userId,
            content: dto.content,
            type: postType,
            imageUrls,
            category: dto.category,
        });

        return this.postsRepo.save(post);
    }

    async createPoll(userId: string, dto: CreatePollDto, optionImages?: { [optionIndex: number]: any }): Promise<Post> {
        // Upload images for options if provided
        const options: PollOption[] = await Promise.all(
            dto.options.map(async (option, index) => {
                let imageUrl: string | undefined;

                // Check if there's an uploaded image for this option
                if (optionImages && optionImages[index]) {
                    const uploaded = await this.s3StorageService.uploadFile(optionImages[index], 'polls');
                    imageUrl = uploaded.url;
                } else if (option.imageUrl) {
                    // Use provided URL
                    imageUrl = option.imageUrl;
                }

                return {
                    id: randomUUID(),
                    text: option.text,
                    imageUrl,
                    voteCount: 0,
                };
            }),
        );

        // Determine poll type based on whether any option has an image
        const postType = options.some((opt) => opt.imageUrl) ? PostType.POLL_WITH_IMAGES : PostType.POLL;

        // Calculate expiration date if duration is provided
        let expiresAt: Date | undefined;
        if (dto.durationDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + dto.durationDays);
        }

        const post = this.postsRepo.create({
            userId,
            content: dto.content,
            type: postType,
            question: dto.question,
            pollOptions: options,
            multipleSelection: dto.multipleSelection || false,
            durationDays: dto.durationDays,
            expiresAt,
            category: dto.category,
        });

        return this.postsRepo.save(post);
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

        return post;
    }

    async getPosts(category?: string, limit: number = 20, offset: number = 0): Promise<Post[]> {
        const queryBuilder = this.postsRepo
            .createQueryBuilder('post')
            .where('post.isDeleted = :isDeleted', { isDeleted: false })
            .andWhere('(post.type != :pollType AND post.type != :pollWithImagesType)', {
                pollType: PostType.POLL,
                pollWithImagesType: PostType.POLL_WITH_IMAGES,
            })
            .orderBy('post.createdAt', 'DESC')
            .take(limit)
            .skip(offset);

        if (category) {
            queryBuilder.andWhere('post.category = :category', { category });
        }

        return queryBuilder.getMany();
    }

    async getPolls(category?: string, limit: number = 20, offset: number = 0): Promise<Post[]> {
        const queryBuilder = this.postsRepo
            .createQueryBuilder('post')
            .where('post.isDeleted = :isDeleted', { isDeleted: false })
            .andWhere('(post.type = :pollType OR post.type = :pollWithImagesType)', {
                pollType: PostType.POLL,
                pollWithImagesType: PostType.POLL_WITH_IMAGES,
            })
            .andWhere('(post.expiresAt IS NULL OR post.expiresAt > :now)', { now: new Date() })
            .andWhere('post.isClosed = :isClosed', { isClosed: false })
            .orderBy('post.createdAt', 'DESC')
            .take(limit)
            .skip(offset);

        if (category) {
            queryBuilder.andWhere('post.category = :category', { category });
        }

        return queryBuilder.getMany();
    }

    async getPostById(id: string): Promise<Post> {
        const post = await this.postsRepo.findOne({ where: { id, isDeleted: false } });

        if (!post) {
            throw new NotFoundException('Post not found');
        }

        return post;
    }

    async getPollById(id: string): Promise<Post> {
        const post = await this.postsRepo.findOne({
            where: { id, isDeleted: false },
        });

        if (!post) {
            throw new NotFoundException('Poll not found');
        }

        if (post.type !== PostType.POLL && post.type !== PostType.POLL_WITH_IMAGES) {
            throw new BadRequestException('This post is not a poll');
        }

        return post;
    }

    async getUserVote(userId: string, postId: string): Promise<PollVote[]> {
        return this.pollVotesRepo.find({ where: { userId, postId } });
    }
}

