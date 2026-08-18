import { Role } from "src/enums/role.enum";

export interface UserInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	name: string;
	email: string;
	password: string;
	phone: string;
	role: Role;
}