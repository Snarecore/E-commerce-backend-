export interface VendorMessageInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	name: string;
    email: string;
    message: string;
	vendorId: string;
}