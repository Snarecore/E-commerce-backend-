export interface ContactUsMessageInterface {
	name: string;
    email: string;
	phone: string;
    message: string;
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
}