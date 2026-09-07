export class CreateOrderDto {
  clientOrderRef!: string;
  totalAmount!: number;
  currency?: string;
  customerName!: string;
  customerEmail?: string;
  items!: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
}
