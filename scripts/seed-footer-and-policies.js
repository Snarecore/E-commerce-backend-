require('dotenv').config();
const { DataSource } = require('typeorm');

const PRIVACY_POLICY = {
    title: 'Privacy Policy',
    description: `<h2>Privacy Policy</h2>
<p><strong>Effective Date:</strong> January 1, 2026</p>
<p>Welcome to <strong>Fashion Time</strong> ("we", "our", or "us"). We are committed to protecting your privacy and ensuring that your personal information is handled in a safe, secure, and responsible manner. This Privacy Policy outlines the types of information we collect, how it is used, and the steps we take to protect your data when you visit our website, mobile application, or make purchases with us.</p>

<h3>1. Information We Collect</h3>
<p>We collect information to provide better services and a seamless shopping experience for all our customers. The information we gather includes:</p>
<ul>
    <li><strong>Personal Information:</strong> Full name, email address, phone number, delivery address, billing address, and optional account credentials.</li>
    <li><strong>Order &amp; Transaction Details:</strong> Products purchased, order dates, transaction reference numbers, order amounts, and payment method details (note: credit/debit card details are processed directly through secure PCI-DSS compliant third-party payment gateways and are never stored on our servers).</li>
    <li><strong>Device &amp; Usage Information:</strong> IP address, browser type, operating system, device identifiers, pages viewed, time spent on pages, and referring URLs.</li>
    <li><strong>Cookies &amp; Tracking Technologies:</strong> Small data files used to remember your cart items, preferences, and optimize site navigation.</li>
</ul>

<h3>2. How We Use Your Information</h3>
<p>We use the collected information for the following business purposes:</p>
<ul>
    <li>To process, fulfill, and deliver your orders accurately and promptly.</li>
    <li>To communicate with you regarding order confirmations, tracking updates, and customer support queries.</li>
    <li>To detect, prevent, and mitigate fraudulent transactions, abuse, or security incidents.</li>
    <li>To improve and customize our website layout, product catalog, search filters, and overall user experience.</li>
    <li>To send promotional updates, seasonal offers, and discount alerts (only when you have opted in, with full freedom to unsubscribe at any time).</li>
</ul>

<h3>3. Information Sharing &amp; Disclosure</h3>
<p>We do not sell, rent, or trade your personal information to third parties for marketing purposes. We only share necessary data with:</p>
<ul>
    <li><strong>Logistics &amp; Courier Partners:</strong> Delivery services (e.g., RedX, Pathao, Steadfast) strictly to deliver your orders to your designated shipping address.</li>
    <li><strong>Payment Gateway Providers:</strong> Secure payment aggregators (e.g., SSLCommerz, bKash, Nagad, Mastercard/Visa) to process online payments safely.</li>
    <li><strong>Legal &amp; Regulatory Authorities:</strong> When required by law, court order, or government regulation to comply with legal obligations and safeguard public safety.</li>
</ul>

<h3>4. Data Security</h3>
<p>We implement robust industry-standard physical, electronic, and managerial safeguards to protect your personal data against unauthorized access, alteration, disclosure, or destruction. All communication between your browser and our servers is secured using SSL/TLS 256-bit encryption.</p>

<h3>5. Your Rights &amp; Choices</h3>
<p>As a valued customer, you have the right to:</p>
<ul>
    <li>Access and review the personal information stored in your account profile.</li>
    <li>Request updates, corrections, or deletion of your personal details.</li>
    <li>Opt out of marketing communications by clicking the unsubscribe link in our emails or updating your notification preferences.</li>
</ul>

<h3>6. Contact Us</h3>
<p>If you have any questions, suggestions, or concerns regarding our Privacy Policy or data handling practices, please contact us:</p>
<ul>
    <li><strong>Helpline:</strong> +880 1317-020309</li>
    <li><strong>Email:</strong> support@fashiontime.com / snarecode@gmail.com</li>
    <li><strong>Address:</strong> Dhanmondi, Dhaka, Bangladesh</li>
</ul>`
};

const RETURN_REFUND_POLICY = {
    title: 'Return & Refund Policy',
    description: `<h2>Return &amp; Refund Policy</h2>
<p><strong>Effective Date:</strong> January 1, 2026</p>
<p>At <strong>Fashion Time</strong>, customer satisfaction is our top priority. We take great pride in delivering premium quality apparel and traditional attire. If for any reason you are not completely satisfied with your purchase, we are here to support you with an easy and transparent return and exchange policy.</p>

<h3>1. Eligibility for Returns &amp; Exchanges</h3>
<p>You may request an exchange or return under the following conditions:</p>
<ul>
    <li>The request is initiated within <strong>7 days</strong> from the date of product delivery.</li>
    <li>The product is <strong>unworn, unwashed, unaltered</strong>, and free of any odor, makeup stains, perfume scent, or damage.</li>
    <li>The item is returned in its <strong>original packaging</strong> with all original tags, labels, and accessories attached.</li>
    <li>Proof of purchase (Order ID, invoice, or registered phone number) must be provided.</li>
</ul>

<h3>2. Non-Returnable &amp; Non-Exchangeable Items</h3>
<p>For hygiene, customization, and promotional reasons, the following items are strictly non-returnable:</p>
<ul>
    <li>Items marked as "Clearance", "Flash Sale", or "Final Sale".</li>
    <li>Custom-tailored, stitched-to-order, or altered apparel.</li>
    <li>Innerwear, lingerie, or intimate apparel.</li>
    <li>Items returned after the 7-day eligibility window.</li>
</ul>

<h3>3. Exchange Process</h3>
<ol>
    <li><strong>Size or Fit Issue:</strong> If you need a different size for the same product, contact our support team or initiate an exchange request from your user dashboard.</li>
    <li><strong>Stock Availability:</strong> Exchanges are subject to size and stock availability. If your desired size is out of stock, you may choose an alternative product of equal value or receive a store credit/refund.</li>
    <li><strong>Defective or Incorrect Item:</strong> If you received a damaged product, manufacturing defect, or incorrect color/model, we will replace the item with free door-to-door courier pick-up and replacement delivery at zero additional cost to you.</li>
</ol>

<h3>4. Return Shipping Costs</h3>
<ul>
    <li><strong>Store Fault / Defective Items:</strong> Fashion Time covers 100% of the return and replacement courier charges.</li>
    <li><strong>Customer Preference / Change of Mind:</strong> If you wish to exchange due to personal preference, standard courier delivery fees will apply for the exchange process.</li>
</ul>

<h3>5. Refund Timelines &amp; Methods</h3>
<p>Once your returned item arrives at our fulfillment center, it undergoes quality inspection within <strong>2 business days</strong>.</p>
<ul>
    <li><strong>Digital Payment Refunds:</strong> Refunds for orders paid via bKash, Nagad, Credit/Debit Card, or Internet Banking will be credited back to the original payment channel within <strong>5 to 7 business days</strong>.</li>
    <li><strong>Cash on Delivery (COD) Refunds:</strong> For COD orders, refunds are sent via your preferred mobile banking account (bKash/Nagad) or direct bank transfer within <strong>3 to 5 business days</strong> after inspection.</li>
</ul>

<h3>6. Need Help with a Return?</h3>
<p>Our dedicated support team is available 7 days a week to assist you:</p>
<ul>
    <li><strong>Helpline:</strong> +880 1317-020309</li>
    <li><strong>Email:</strong> support@fashiontime.com / snarecode@gmail.com</li>
    <li><strong>Hours:</strong> 9:00 AM &ndash; 10:00 PM (Everyday)</li>
</ul>`
};

const TERMS_AND_CONDITIONS = {
    title: 'Terms & Conditions',
    description: `<h2>Terms &amp; Conditions</h2>
<p><strong>Effective Date:</strong> January 1, 2026</p>
<p>Welcome to <strong>Fashion Time</strong>. These Terms &amp; Conditions ("Terms") govern your access to and use of the Fashion Time website, mobile services, and purchase of goods from our online store. By browsing, accessing, or placing an order on our platform, you acknowledge that you have read, understood, and agree to be bound by these Terms.</p>

<h3>1. Account Registration &amp; Security</h3>
<ul>
    <li>To place orders or access specific features, you may register an account with accurate and up-to-date information.</li>
    <li>You are responsible for maintaining the confidentiality of your account password and restricting unauthorized access to your device.</li>
    <li>You must notify us immediately of any unauthorized use or security breach of your account.</li>
</ul>

<h3>2. Product Information, Pricing &amp; Availability</h3>
<ul>
    <li>We make every effort to display the colors, fabrics, and details of our clothing products as accurately as possible. However, actual colors may vary slightly depending on your monitor display settings and lighting conditions during photography.</li>
    <li>All prices are listed in Bangladeshi Taka (BDT) and are subject to change without prior notice.</li>
    <li>In the rare event of a pricing error or stock discrepancy, Fashion Time reserves the right to cancel or adjust the order and issue a full refund.</li>
</ul>

<h3>3. Orders, Payments &amp; Delivery</h3>
<ul>
    <li><strong>Order Confirmation:</strong> An order is confirmed upon successful checkout and automated confirmation notification (SMS/Email/Call).</li>
    <li><strong>Payment Options:</strong> We accept Cash on Delivery (COD), bKash, Nagad, Rocket, Visa, Mastercard, and American Express cards.</li>
    <li><strong>Delivery Timeline:</strong> Inside Dhaka deliveries typically arrive within 24&ndash;48 hours. Deliveries outside Dhaka are delivered within 3&ndash;5 business days via trusted courier partners.</li>
    <li><strong>Delivery Delays:</strong> While we strive for on-time delivery, delays caused by weather conditions, courier disruptions, or public holidays are beyond our direct control.</li>
</ul>

<h3>4. Cancellation Policy</h3>
<p>You may cancel an order free of charge at any time before it has been dispatched from our warehouse. Once the parcel is handed over to the courier service, standard return procedures apply.</p>

<h3>5. Intellectual Property</h3>
<p>All content included on this website &ndash; such as brand logos, graphics, product photography, text descriptions, software, and banners &ndash; is the exclusive intellectual property of Fashion Time and protected under applicable copyright and trademark laws. Any unauthorized reproduction, modification, or distribution is strictly prohibited.</p>

<h3>6. Limitation of Liability</h3>
<p>Fashion Time shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from the use of our website, delay in delivery, or temporary unavailability of services.</p>

<h3>7. Governing Law</h3>
<p>These Terms &amp; Conditions are governed by and construed in accordance with the laws of Bangladesh. Any dispute arising out of or related to these terms shall be subject to the exclusive jurisdiction of the courts of Dhaka, Bangladesh.</p>

<h3>8. Contact Information</h3>
<p>If you have any questions or require clarification about these Terms &amp; Conditions, please reach out to us:</p>
<ul>
    <li><strong>Helpline:</strong> +880 1317-020309</li>
    <li><strong>Email:</strong> support@fashiontime.com / snarecode@gmail.com</li>
    <li><strong>Office:</strong> Dhanmondi, Dhaka, Bangladesh</li>
</ul>`
};

const HEADER_FOOTER_SETTINGS = {
    helpline: '+880 1317-020309',
    contactEmail: 'snarecode@gmail.com',
    contactPhone: '+880 1317-020309',
    contactAddress: 'House 12, Road 5, Dhanmondi, Dhaka, Bangladesh',
    copyrightText: '© 2026 Fashion Time. All rights reserved.',
    bannerText: 'Welcome to Fashion Time | Discover Exclusive Clothing & Trends',
    footerDescription: 'Fashion Time is your premier online destination for trendsetting fashion, premium men\'s wear, exclusive women\'s lawn suits, luxury kurtis, and contemporary designer collections crafted for elegance and everyday comfort.',
    footerSectionTwoTitle: 'Quick Links',
    footerSectionTwo: [
        { value: 'Home', link: '/' },
        { value: 'Shop All', link: '/shop' },
        { value: 'All Categories', link: '/all-categories' },
        { value: 'Contact Us', link: '/contact' }
    ],
    footerSectionThreeTitle: 'Customer Care & Policies',
    footerSectionThree: [
        { value: 'Privacy Policy', link: '/privacy-policy' },
        { value: 'Return & Refund Policy', link: '/exchange-policy' },
        { value: 'Terms & Conditions', link: '/terms-conditions' },
        { value: 'FAQ & Support', link: '/faq' }
    ]
};

async function seedFooterAndPolicies() {
    const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 3306;
    const username = process.env.DATABASE_USERNAME || process.env.DB_USER || 'root';
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '';
    const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'bazaarbound';
    const isSslRequired = process.env.DATABASE_SSL === 'true' || host.includes('tidbcloud.com');

    console.log(`🔌 Connecting to Database '${database}' at ${host}:${port}...`);

    const ds = new DataSource({
        type: 'mysql',
        host,
        port,
        username,
        password,
        database,
        ssl: isSslRequired ? { rejectUnauthorized: true, minVersion: 'TLSv1.2' } : false,
        logging: false
    });

    await ds.initialize();
    console.log('✅ Database connected successfully!\n');

    // 1. Update Header-Footer CMS
    console.log('📌 Updating Header & Footer CMS Configuration...');
    const hfRows = await ds.query('SELECT id FROM `header-footer-cms` LIMIT 1');
    if (hfRows.length > 0) {
        await ds.query(
            `UPDATE \`header-footer-cms\` SET
                helpline = ?,
                contactEmail = ?,
                contactPhone = ?,
                contactAddress = ?,
                copyrightText = ?,
                bannerText = ?,
                footerDescription = ?,
                footerSectionTwoTitle = ?,
                footerSectionThreeTitle = ?,
                footerSectionTwo = ?,
                footerSectionThree = ?,
                updatedAt = NOW()
            WHERE id = ?`,
            [
                HEADER_FOOTER_SETTINGS.helpline,
                HEADER_FOOTER_SETTINGS.contactEmail,
                HEADER_FOOTER_SETTINGS.contactPhone,
                HEADER_FOOTER_SETTINGS.contactAddress,
                HEADER_FOOTER_SETTINGS.copyrightText,
                HEADER_FOOTER_SETTINGS.bannerText,
                HEADER_FOOTER_SETTINGS.footerDescription,
                HEADER_FOOTER_SETTINGS.footerSectionTwoTitle,
                HEADER_FOOTER_SETTINGS.footerSectionThreeTitle,
                JSON.stringify(HEADER_FOOTER_SETTINGS.footerSectionTwo),
                JSON.stringify(HEADER_FOOTER_SETTINGS.footerSectionThree),
                hfRows[0].id
            ]
        );
        console.log('  ✓ Updated existing Header-Footer CMS record');
    } else {
        const { v4: uuidv4 } = require('uuid');
        await ds.query(
            `INSERT INTO \`header-footer-cms\` (id, helpline, contactEmail, contactPhone, contactAddress, copyrightText, bannerText, footerDescription, footerSectionTwoTitle, footerSectionThreeTitle, footerSectionTwo, footerSectionThree, isDeleted, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
            [
                uuidv4(),
                HEADER_FOOTER_SETTINGS.helpline,
                HEADER_FOOTER_SETTINGS.contactEmail,
                HEADER_FOOTER_SETTINGS.contactPhone,
                HEADER_FOOTER_SETTINGS.contactAddress,
                HEADER_FOOTER_SETTINGS.copyrightText,
                HEADER_FOOTER_SETTINGS.bannerText,
                HEADER_FOOTER_SETTINGS.footerDescription,
                HEADER_FOOTER_SETTINGS.footerSectionTwoTitle,
                HEADER_FOOTER_SETTINGS.footerSectionThreeTitle,
                JSON.stringify(HEADER_FOOTER_SETTINGS.footerSectionTwo),
                JSON.stringify(HEADER_FOOTER_SETTINGS.footerSectionThree)
            ]
        );
        console.log('  ✓ Created new Header-Footer CMS record');
    }

    // 2. Update Privacy Policy CMS
    console.log('📌 Updating Privacy Policy CMS...');
    const privRows = await ds.query('SELECT id FROM `privacy-policy-cms` LIMIT 1');
    if (privRows.length > 0) {
        await ds.query(
            `UPDATE \`privacy-policy-cms\` SET title = ?, description = ?, updatedAt = NOW() WHERE id = ?`,
            [PRIVACY_POLICY.title, PRIVACY_POLICY.description, privRows[0].id]
        );
        console.log('  ✓ Updated `privacy-policy-cms` table');
    }

    // Also update policy-one-cms for dynamic route mapping
    const p1Rows = await ds.query('SELECT id FROM `policy-one-cms` LIMIT 1');
    if (p1Rows.length > 0) {
        await ds.query(
            `UPDATE \`policy-one-cms\` SET title = ?, description = ?, updatedAt = NOW() WHERE id = ?`,
            [PRIVACY_POLICY.title, PRIVACY_POLICY.description, p1Rows[0].id]
        );
        console.log('  ✓ Updated `policy-one-cms` table');
    }

    // 3. Update Return & Refund Policy CMS
    console.log('📌 Updating Return & Refund Policy CMS...');
    const retRows = await ds.query('SELECT id FROM `return_policy_cms` LIMIT 1');
    if (retRows.length > 0) {
        await ds.query(
            `UPDATE \`return_policy_cms\` SET title = ?, description = ?, updatedAt = NOW() WHERE id = ?`,
            [RETURN_REFUND_POLICY.title, RETURN_REFUND_POLICY.description, retRows[0].id]
        );
        console.log('  ✓ Updated `return_policy_cms` table');
    }

    // Also update policy-two-cms for dynamic route mapping
    const p2Rows = await ds.query('SELECT id FROM `policy-two-cms` LIMIT 1');
    if (p2Rows.length > 0) {
        await ds.query(
            `UPDATE \`policy-two-cms\` SET title = ?, description = ?, updatedAt = NOW() WHERE id = ?`,
            [RETURN_REFUND_POLICY.title, RETURN_REFUND_POLICY.description, p2Rows[0].id]
        );
        console.log('  ✓ Updated `policy-two-cms` table');
    }

    // 4. Update Terms & Conditions CMS
    console.log('📌 Updating Terms & Conditions CMS...');
    const termsRows = await ds.query('SELECT id FROM `terms_and_conditions_cms` LIMIT 1');
    if (termsRows.length > 0) {
        await ds.query(
            `UPDATE \`terms_and_conditions_cms\` SET title = ?, description = ?, updatedAt = NOW() WHERE id = ?`,
            [TERMS_AND_CONDITIONS.title, TERMS_AND_CONDITIONS.description, termsRows[0].id]
        );
        console.log('  ✓ Updated `terms_and_conditions_cms` table');
    }

    // Also update policy-three-cms for dynamic route mapping
    const p3Rows = await ds.query('SELECT id FROM `policy-three-cms` LIMIT 1');
    if (p3Rows.length > 0) {
        await ds.query(
            `UPDATE \`policy-three-cms\` SET title = ?, description = ?, updatedAt = NOW() WHERE id = ?`,
            [TERMS_AND_CONDITIONS.title, TERMS_AND_CONDITIONS.description, p3Rows[0].id]
        );
        console.log('  ✓ Updated `policy-three-cms` table');
    }

    console.log('\n🎉 Successfully updated Footer links, Privacy Policy, Return/Refund Policy, and Terms & Conditions!');

    await ds.destroy();
}

seedFooterAndPolicies().catch(err => {
    console.error('❌ Seeding Error:', err);
    process.exit(1);
});
