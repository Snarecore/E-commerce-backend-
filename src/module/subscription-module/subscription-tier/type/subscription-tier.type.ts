export interface SubscriptionTierInterface {
    id: string;
    name: string;
    commissionRate: number;
    durationInMonths: number;
    price: number;
    isDeleted: boolean;
}
