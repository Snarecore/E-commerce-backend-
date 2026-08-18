export interface UniqueCodeGeneratorInterface {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	isDeleted: boolean;
	productCode: string;
	orderId: string;
}