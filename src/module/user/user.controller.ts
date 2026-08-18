import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CONFIG } from 'src/utils/config';
import { UserService } from './user.service';
import { ApiResponse } from 'src/utils/response.utils';
import { UserInterface } from './type/user.type';
import { UserFilterDto } from './dto/user-filter.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/role.guard';
import { Roles } from 'src/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { Request } from 'express';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadMulterFile } from '../space-module/space-service';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Controller({ path: 'user', version: CONFIG.API_VERSION })
export class UserController {
    constructor(private readonly userService: UserService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER)
    @Patch('/customer-profile')
    @UseInterceptors(FileFieldsInterceptor(
        [
            { name: "profileImage", maxCount: 1 }
        ]
    ))
    async updateCustomerProfile(
        @Req() req: Request,
        @Body() dto: UpdateUserProfileDto,
        @UploadedFiles() files: {
            profileImage?: UploadMulterFile
        }
    ) {
        return await this.userService.updateCustomerProfile(req.user, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Patch('/vendor-profile')
    @UseInterceptors(FileFieldsInterceptor(
        [
            { name: "shopImage", maxCount: 1 },
            { name: "profileImage", maxCount: 1 }
        ]
    ))
    async updateVendorProfile(
        @Req() req: Request,
        @Body() dto: UpdateUserProfileDto,
        @UploadedFiles() files: {
            shopImage?: UploadMulterFile,
            profileImage?: UploadMulterFile
        }
    ) {
        return await this.userService.updateVendorProfile(req.user, dto, files);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER)
    @Patch('/customer-password')
    async updateCustomerPassword(
        @Req() req: Request,
        @Body() dto: UpdatePasswordDto
    ) {
        return await this.userService.updatePassword(req.user, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Patch('/vendor-password')
    async updateVendorPassword(
        @Req() req: Request,
        @Body() dto: UpdatePasswordDto
    ) {
        return await this.userService.updatePassword(req.user, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Get()
    async findAll(@Query() dto: UserFilterDto): Promise<ApiResponse<{ data: UserInterface[]; total: number; page: number; limit: number; pageCount: number; }>> {
        return await this.userService.findAll(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.CUSTOMER)
    @Get('/customer')
    async findCustomerData(@Req() req: Request) {
        return await this.userService.findOneCustomer(req.user);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.VENDOR)
    @Get('/vendor')
    async findVendorData(@Req() req: Request) {
        return await this.userService.findOneVendor(req.user);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    async remove(@Param('id') id: string): Promise<ApiResponse<boolean>> {
        return await this.userService.remove(id);
    }
}
