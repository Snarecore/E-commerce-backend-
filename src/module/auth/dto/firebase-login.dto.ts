import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FirebaseLoginDto {
	@IsString()
	@IsNotEmpty()
	idToken: string;

	// Profile hints from the client. Identity (email, uid) always comes from the verified idToken.
	@IsString()
	@IsOptional()
	name?: string;

	@IsString()
	@IsOptional()
	photoURL?: string;

	@IsString()
	@IsOptional()
	email?: string;

	@IsString()
	@IsOptional()
	firebaseUid?: string;
}
