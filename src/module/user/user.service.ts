import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { UserFilterDto } from './dto/user-filter.dto';
import { ApiResponse, ResponseUtils } from 'src/utils/response.utils';
import { UserInterface } from './type/user.type';
import { FindOptionsOrder } from 'typeorm';
import { User } from './entities/user.entity';
import { UserFilter } from './type/user-filter.type';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { SpaceService } from '../space-module/space-service/space.service';
import { UploadMulterFile } from '../space-module/space-service';
import * as bcrypt from 'bcryptjs';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly userProfileRepository: UserProfileRepository,
        private readonly spaceService: SpaceService
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
                createdAt: 'desc'
            };

            const result = await this.userRepository.paginate({
                page: dto.page ? dto?.page : 1,
                limit: dto.limit ? dto?.limit : 10,
                query,
                order
            });

            const payload = {
                data: result?.data,
                total: result.total,
                page: result.page,
                limit: result.limit,
                pageCount: result.pageCount
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findOneCustomer(userData: any) {
        try {
            const user = await this.userRepository.findOne(userData.id);
            if (!user) {
                throw new HttpException('User not found!', HttpStatus.BAD_REQUEST);
            }

            const profile = await this.userProfileRepository.findOneByQuery({ user: { id: user.id } });

            const payload = {
                ...user,
                profile: profile || null
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

     async findOneVendor(userData: any) {
        try {
            const user = await this.userRepository.findOne(userData.id);
            if (!user) {
                throw new HttpException('User not found!', HttpStatus.BAD_REQUEST);
            }

            const profile = await this.userProfileRepository.findOneByQuery({ user: { id: user.id } });

            const payload = {
                ...user,
                profile: profile || null
            };

            return ResponseUtils.successResponseHandler(200, 'Data retrieved successfully.', 'data', payload);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
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
            const user = await this.userRepository.findOne(userData.id);
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
                    'users'
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
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateVendorProfile(
        userData: any, 
        dto: UpdateUserProfileDto,
        files: {
            shopImage?: UploadMulterFile;
            profileImage?: UploadMulterFile;
        }
    ) {
        try {
            const user = await this.userRepository.findOne(userData.id);
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
                    'users'
                );
                dto.profileImage = imageUrl;
            }

            dto.shopImage = profile?.shopImage;
            if (files?.shopImage?.[0]) {
                const imageUrl = await this.spaceService.uploadFile(
                    files.shopImage[0],
                    'users'
                );
                dto.shopImage = imageUrl;
            }

            const updatedProfileData = {
                shopName: dto.shopName ?? profile?.shopName,
                profileImage: dto.profileImage ?? profile?.profileImage,
                shopImage: dto.shopImage ?? profile?.shopImage,
                accountNumber: dto.accountNumber ?? profile?.accountNumber,
                accountHolderName: dto.accountHolderName ?? profile?.accountHolderName,
                bankName: dto.bankName ?? profile?.bankName,
                branchName: dto.branchName ?? profile?.branchName,
                IBAN: dto.IBAN ?? profile?.IBAN,
                country: dto.country ?? profile?.country,
                swiftCode: dto.swiftCode ?? profile?.swiftCode,
                paypalEmailAddress: dto.paypalEmailAddress ?? profile?.paypalEmailAddress
            };

            if (profile) {
                await this.userProfileRepository.update(profile.id, updatedProfileData);
            } else {
                await this.userProfileRepository.create({
                    ...updatedProfileData,
                    user
                });
            }

            return ResponseUtils.successResponseHandler(200, 'Profile updated successfully.', 'data', {});
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updatePassword(userData: any, dto: UpdatePasswordDto) {
        try {
            const user = await this.userRepository.findOne(userData.id);
            if (!user) {
                throw new HttpException('User not found!', HttpStatus.BAD_REQUEST);
            }

            const isPasswordMatch = await bcrypt.compare(dto.currentPassword, user.password);
            if (!isPasswordMatch) {
                throw new HttpException('Current password is incorrect.', HttpStatus.UNAUTHORIZED);
            }

            if (dto.newPassword !== dto.confirmPassword) {
                throw new HttpException('New password and confirm password do not match.', HttpStatus.BAD_REQUEST);
            }

            if (dto.currentPassword === dto.newPassword) {
                throw new HttpException('New password must be different from the current password.', HttpStatus.BAD_REQUEST);
            }

            const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);

            await this.userRepository.update(user.id, {
                password: hashedNewPassword
            });

            return ResponseUtils.successResponseHandler(200, 'Password updated successfully.', 'data', {});
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async remove(id: string): Promise<ApiResponse<boolean>> {
		try {
			const output = await this.userRepository.findOne(id);
			if (!output) {
				throw new HttpException('Data not found!', HttpStatus.BAD_REQUEST);
			}
			const response = await this.userRepository.softDelete(id);
			const result = response !== null;
        	return ResponseUtils.deleteResponseHandler(200, 'Data deleted successfully.', result);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
			throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
