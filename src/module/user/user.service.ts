import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { UserFilterDto } from './dto/user-filter.dto';
import { ApiResponse, ResponseUtils } from '../../utils/response.utils';
import { UserInterface } from './type/user.type';
import { FindOptionsOrder } from 'typeorm';
import { User } from './entities/user.entity';
import { UserFilter } from './type/user-filter.type';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { SpaceService } from '../space-module/space-service/space.service';
import { UploadMulterFile } from '../space-module/space-service';
import { hashPassword, verifyPassword } from '../../utils/bcrypt.utils';
import { UpdatePasswordDto } from './dto/update-password.dto';

import { toSafeUser } from '../../utils/safe-user.utils';
import { UploadPolicy } from '../../common/upload/upload.policy';
import { AuthSessionService } from '../auth/session/auth-session.service';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly userProfileRepository: UserProfileRepository,
        private readonly spaceService: SpaceService,
        private readonly authSessionService: AuthSessionService
    ) {}

    async findAll(
        dto: UserFilterDto
    ): Promise<ApiResponse<{ data: UserInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
        try {
            let query: UserFilter = {};

            if (dto.role) {
				query.role = dto.role;
			}

            const order: FindOptionsOrder<User> = {
                createdAt: 'desc',
                id: 'desc'
            };

            const result = await this.userRepository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order
            });

            const safeData = (result?.data ?? []).map(toSafeUser);

            const payload = {
                data: safeData as unknown as UserInterface[],
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            // HttpExceptions keep their status; anything else is logged and masked by the global filter
            throw error;
        }
    }

    async findOneCustomer(userData: any) {
        try {
            const userId = userData?.id || userData?.userId || userData?.sub;
            let user = userId ? await this.userRepository.findOne(userId) : null;
            if (!user && userData?.email) {
                user = await this.userRepository.findOneByQuery({ email: userData.email });
            }
            if (!user) {
                throw new HttpException('User not found!', HttpStatus.BAD_REQUEST);
            }

            const profile = await this.userProfileRepository.findOneByQuery({ user: { id: user.id } });

            const payload = {
                ...toSafeUser(user),
                profile: profile || null
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            // HttpExceptions keep their status; anything else is logged and masked by the global filter
            throw error;
        }
    }

    async updateCustomerProfile(
        userData: any, 
        dto: UpdateUserProfileDto,
        files: {
            profileImage?: UploadMulterFile;
        }
    ) {
        try {
            const userId = userData?.id || userData?.userId || userData?.sub;
            let user = userId ? await this.userRepository.findOne(userId) : null;
            if (!user && userData?.email) {
                user = await this.userRepository.findOneByQuery({ email: userData.email });
            }
            if (!user) {
                throw new HttpException('User not found!', HttpStatus.BAD_REQUEST);
            }

            if (dto.name || dto.phone) {
                await this.userRepository.update(user.id, {
                    name: dto.name ?? user.name,
                    phone: dto.phone ?? user.phone
                });
            }

            let profile = await this.userProfileRepository.findOneByQuery({ user: { id: user.id } });

            dto.profileImage = profile?.profileImage;
            if (files?.profileImage?.[0]) {
                const imageUrl = await this.spaceService.uploadFile(
                    files.profileImage[0],
                    'users',
                    UploadPolicy.CUSTOMER_IMAGE.allowed
                );
                dto.profileImage = imageUrl;
            }

            if (profile) {
                await this.userProfileRepository.update(profile.id, {
                    shopName: dto.shopName ?? profile.shopName,
                    profileImage: dto.profileImage ?? profile.profileImage,
                    shopImage: dto.shopImage ?? profile.shopImage
                });
            } else {
                await this.userProfileRepository.create({
                    shopName: dto.shopName,
                    profileImage: dto.profileImage,
                    shopImage: dto.shopImage,
                    user
                });
            }

            return ResponseUtils.successResponseHandler(200, 'Profile updated successfully.', 'data', {});
        } catch (error: unknown) {
            // HttpExceptions keep their status; anything else is logged and masked by the global filter
            throw error;
        }
    }

    async updatePassword(userData: any, dto: UpdatePasswordDto) {
        try {
            const userId = userData?.id || userData?.userId || userData?.sub;
            let user = userId ? await this.userRepository.findOne(userId) : null;
            if (!user && userData?.email) {
                user = await this.userRepository.findOneByQuery({ email: userData.email });
            }
            if (!user) {
                throw new HttpException('User not found!', HttpStatus.BAD_REQUEST);
            }

            const isPasswordMatch = await verifyPassword(dto.currentPassword, user.password);
            if (!isPasswordMatch) {
                throw new HttpException('Current password is incorrect.', HttpStatus.UNAUTHORIZED);
            }

            if (dto.newPassword !== dto.confirmPassword) {
                throw new HttpException('New password and confirm password do not match.', HttpStatus.BAD_REQUEST);
            }

            if (dto.currentPassword === dto.newPassword) {
                throw new HttpException('New password must be different from the current password.', HttpStatus.BAD_REQUEST);
            }

            const hashedNewPassword = await hashPassword(dto.newPassword);

            await this.userRepository.update(user.id, {
                password: hashedNewPassword
            });

            // A changed password must lock out anyone holding an old session; this device stays signed in
            await this.authSessionService.revokeOtherSessions(user.id, userData?.sessionId, 'password_changed');

            return ResponseUtils.successResponseHandler(200, 'Password updated successfully.', 'data', {});
        } catch (error) {
            // HttpExceptions keep their status; anything else is logged and masked by the global filter
            throw error;
        }
    }

    async remove(id: string): Promise<ApiResponse<boolean>> {
		try {
			const output = await this.userRepository.findOne(id);
			if (!output) {
				throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
			}
			const response = await this.userRepository.softDelete(id);
			// A deleted account keeps no access: end its sessions and drop its live sockets
			await this.authSessionService.revokeAllForUser(id, 'account_deleted');
			const result = response !== null;
        	return ResponseUtils.deleteResponseHandler(200, 'Data deleted successfully.', result);
		} catch (error: unknown) {
			// HttpExceptions keep their status; anything else is logged and masked by the global filter
			throw error;
		}
	}
}
