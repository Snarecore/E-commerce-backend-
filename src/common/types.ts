import { Request } from 'express';
import { Role } from 'src/enums/role.enum';
import { User } from 'src/module/user/entities/user.entity';

export interface SignInInterface {
	user: UserInterface;
	access_token: string;
}
export interface AccessTokenInterface {
	accessToken: string;
}
export interface RefreshTokenInterface {
	refreshToken: string;
	user: User;
}

export interface DeleteInterface {
	deleted: boolean;
}

export interface UserInterface {
	name: string;
	email: string;
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
}

export interface RoleInterface {
	name: string;
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
}

export interface JwtPayLoadInterface {
	id: string;
	username: string;
	email: string;
	role: string;
}
export interface JwtReturnInterface {
	accessToken: string;
	refreshToken: string;
}

export interface DecodeToken {
	id: string;
	username: string;
	email: string;
	role: string;
	iat: number;
	exp: number;
}

export type CookieRefreshToken = string;

export interface AuthenticatedRequest extends Request {
	user?: { email: string };
}

export interface JwtPayload {
	sub: string;
	email: string;
	role: Role;
	name: string;
}
