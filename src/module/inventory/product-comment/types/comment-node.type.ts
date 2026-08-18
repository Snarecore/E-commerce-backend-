import { Role } from 'src/enums/role.enum';

export interface CommentUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: Role;
    profileImage: string | null;
}

export interface CommentNode {
    id: string;
    body: string;
    createdAt: string;
    user: CommentUser | null;
    replies: CommentNode[];  
    replyCount: number;   
}