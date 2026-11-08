export interface ProcessReturnItemDto {
    productId: string;
    productName?: string;
    sku?: string | null;
    size?: string | null;
    returnedQuantity: number;
    condition: 'GOOD' | 'DAMAGED';
    notes?: string | null;
}

export interface ProcessReturnDto {
    orderId: string; // can be UUID id or string orderId
    reason: string;
    notes?: string | null;
    items: ProcessReturnItemDto[];
}
