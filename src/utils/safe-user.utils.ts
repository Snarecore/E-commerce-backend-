import { Role } from "../enums/role.enum";
import { User } from "../module/user/entities/user.entity";

export interface SafeUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: Role;
}

export function toSafeUser(user: User): SafeUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
    };
}