import { AbstractEntity } from '../../../../../database/abstract.entity';
import { Column, Entity } from 'typeorm';

@Entity('home-page-cms')
export class HomePageCms extends AbstractEntity {
	@Column({ type: 'varchar' })
	categorySectionTitle: string;

	@Column({ type: 'boolean', default: true })
    isCategorySectionVisible: boolean;

	@Column({ type: 'varchar' })
	productSectionOneTitle: string;

	@Column({ type: 'boolean', default: true })
    isProductSectionOneVisible: boolean;

	@Column({ type: 'varchar' })
	productSectionOneFontColor: string;

	@Column({ type: 'varchar' })
	productSectionOneBackgroundColor: string;

	@Column({ type: 'varchar' })
	productSectionTwoTitle: string;

	@Column({ type: 'boolean', default: true })
    isProductSectionTwoVisible: boolean;

	@Column({ type: 'varchar' })
	productSectionTwoFontColor: string;

	@Column({ type: 'varchar' })
	productSectionTwoBackgroundColor: string;

	@Column({ type: 'varchar' })
	productSectionThreeTitle: string;

	@Column({ type: 'boolean', default: true })
    isProductSectionThreeVisible: boolean;

	@Column({ type: 'varchar' })
	productSectionThreeFontColor: string;

	@Column({ type: 'varchar' })
	productSectionThreeBackgroundColor: string;

	@Column({ type: 'varchar' })
	productSectionFourTitle: string;

	@Column({ type: 'boolean', default: true })
    isProductSectionFourVisible: boolean;

	@Column({ type: 'varchar' })
	productSectionFourFontColor: string;

	@Column({ type: 'varchar' })
	productSectionFourBackgroundColor: string;

	@Column({ type: 'varchar' })
	productSectionFiveTitle: string;

	@Column({ type: 'boolean', default: true })
    isProductSectionFiveVisible: boolean;

	@Column({ type: 'varchar' })
	productSectionFiveFontColor: string;

	@Column({ type: 'varchar' })
	productSectionFiveBackgroundColor: string;

	@Column({ type: 'varchar' })
	productSectionSixTitle: string;

	@Column({ type: 'boolean', default: true })
    isProductSectionSixVisible: boolean;

	@Column({ type: 'varchar' })
	productSectionSixFontColor: string;

	@Column({ type: 'varchar' })
	productSectionSixBackgroundColor: string;

	@Column({ type: 'varchar' })
	bannerImage: string;

	@Column({ type: 'varchar' })
	bannerImageLink: string;

	@Column({ type: 'boolean', default: true })
	isDeliveryProcessVisible: boolean;

	@Column({ type: 'varchar', default: 'Seamless Fulfillment Journey' })
	deliveryProcessBadge: string;

	@Column({ type: 'varchar', default: 'How Your Order Reaches Your Doorstep' })
	deliveryProcessTitle: string;

	@Column({ type: 'text', nullable: true })
	deliveryProcessDescription: string;

	@Column({ type: 'varchar', default: 'Order & Verification' })
	deliveryStepOneTitle: string;

	@Column({ type: 'varchar', default: 'Instant Confirmation' })
	deliveryStepOneHighlight: string;

	@Column({ type: 'text', nullable: true })
	deliveryStepOneDescription: string;

	@Column({ type: 'varchar', default: 'Quality Check & Packing' })
	deliveryStepTwoTitle: string;

	@Column({ type: 'varchar', default: '100% Inspected' })
	deliveryStepTwoHighlight: string;

	@Column({ type: 'text', nullable: true })
	deliveryStepTwoDescription: string;

	@Column({ type: 'varchar', default: 'Express Dispatch & Transit' })
	deliveryStepThreeTitle: string;

	@Column({ type: 'varchar', default: '24-48h Fast Dispatch' })
	deliveryStepThreeHighlight: string;

	@Column({ type: 'text', nullable: true })
	deliveryStepThreeDescription: string;

	@Column({ type: 'varchar', default: 'Doorstep Delivery & Trial' })
	deliveryStepFourTitle: string;

	@Column({ type: 'varchar', default: '7-Day Easy Returns' })
	deliveryStepFourHighlight: string;

	@Column({ type: 'text', nullable: true })
	deliveryStepFourDescription: string;
}
