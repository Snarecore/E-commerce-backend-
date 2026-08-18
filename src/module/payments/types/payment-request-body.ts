import { Product } from "./product";

export interface PaymentRequestBody {
	products: Product[];
	currency: string;
}
