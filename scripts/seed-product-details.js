require('dotenv').config();
const { DataSource } = require('typeorm');

// Specific mapping by Product ID (for active and legacy DB records)
const PRODUCT_DETAILS_BY_ID = {
    // Active uploaded products in TiDB Cloud DB
    'b80a4b84-74eb-4bc1-b848-f8ad4c91752a': {
        description: `<p>Stay effortlessly stylish with this long sleeve check shirt, a perfect combination of timeless design and contemporary ease. This shirt adds a touch of sophistication to your casual wardrobe. Crafted from soft, breathable 100% premium cotton, it keeps you comfortable all day long, making it an ideal choice for warm-weather outings, office wear, and weekend getaways.</p><ul><li><strong>Fit:</strong> Regular Fit</li><li><strong>Sleeves:</strong> Full Sleeves with adjustable cuffs</li><li><strong>Pattern:</strong> White &amp; Navy Check</li><li><strong>Collar:</strong> Classic Point Collar</li><li><strong>Buttons:</strong> Premium durable buttons</li></ul><p><strong>COMPOSITION &amp; CARE:</strong></p><ul><li>Material: 100% Premium Cotton</li><li>Wash: Machine wash cold inside out</li><li>Bleach: Do Not Bleach</li><li>Iron: Iron on low/medium heat</li></ul>`,
        summary: `• Fabric: 100% Premium Cotton\n• Fit: Regular Fit\n• Pattern: White & Navy Checkered\n• Sleeves: Full Sleeves with Buttoned Cuffs\n• Collar: Classic Point Collar\n• Pocket: Single Patch Chest Pocket\n• Care: Machine Wash Cold, Do Not Bleach`
    },
    '2d96b440-766d-48a1-9c72-1c857b8124dd': {
        description: `<p>Embrace effortless elegance with the Fairy Yellow White 3-Piece Lawn Set (W3P-20068). Designed in soft pastel yellow and pristine white, this ensemble features delicate floral and fairy-inspired embroidery along the neckline and hem. Includes a lightweight printed lawn kameez, comfortable matching cotton trousers, and a gracefully draped printed chiffon dupatta.</p><ul><li><strong>Package Includes:</strong> Unstitched/Stitched 3-Piece Set (Kameez + Trousers + Dupatta)</li><li><strong>Shirt/Kameez:</strong> Premium Printed &amp; Embroidered Lawn</li><li><strong>Bottom/Trousers:</strong> Solid Soft Cotton</li><li><strong>Dupatta:</strong> Breathable Printed Chiffon</li></ul><p><strong>CARE INSTRUCTIONS:</strong></p><ul><li>Gentle hand wash in cold water</li><li>Do not bleach or tumble dry</li><li>Dry flat in shade</li></ul>`,
        summary: `• Product Type: 3-Piece Women's Suit Set\n• Fabric (Kameez): Premium Digital Printed Lawn with Embroidery\n• Fabric (Salwar/Pants): Solid Breathable Cotton\n• Fabric (Dupatta): Printed Chiffon\n• Color: Fairy Yellow & Soft White\n• Occasion: Festive, Casual & Semi-Formal\n• Care: Hand Wash Cold, Iron on Reverse`
    },
    'c5ac9129-5a49-49c6-ba7d-a526411fff56': {
        description: `<p>Make a bold statement with the Emerald Green 3-Piece Lawn Set. Featuring a rich emerald green base enhanced with delicate gold embroidery along the neckline and hemline. Paired with soft matching trousers and a lightweight sheer chiffon dupatta with embellished borders, perfect for evening gatherings, festive events, and family celebrations.</p><ul><li><strong>Set Includes:</strong> Kameez (Top), Salwar/Pants (Bottom), and Dupatta</li><li><strong>Kameez Fabric:</strong> Luxury Lawn Cotton with Thread &amp; Zari Embroidery</li><li><strong>Bottom Fabric:</strong> Soft Dyed Cotton Trousers</li><li><strong>Dupatta Fabric:</strong> Lightweight Printed Chiffon</li></ul><p><strong>CARE INSTRUCTIONS:</strong></p><ul><li>Dry clean recommended for first wash</li><li>Soft hand wash in cold water</li><li>Iron on medium temperature on reverse</li></ul>`,
        summary: `• Product Type: 3-Piece Women's Suit Set\n• Color: Rich Emerald Green with Gold Accents\n• Fabric (Kameez): High-Density Lawn Cotton with Neckline Embroidery\n• Fabric (Salwar): Premium Cotton Slub\n• Fabric (Dupatta): Chiffon Dupatta with Border Lace\n• Fit/Style: Straight Cut Kameez\n• Care: Dry Clean Recommended`
    },
    '5a9351cf-3811-406d-9f7b-0ce10e708a6c': {
        description: `<p>Upgrade your summer and vacation wardrobe with this Leaf Black Half Shirt. Designed with an eye-catching tropical leaf print over a deep black backdrop, this short-sleeve resort shirt offers a relaxed fit and ultra-soft, breathable feel. Perfect for beach trips, casual Fridays, and evening hangouts.</p><ul><li><strong>Fit:</strong> Relaxed Resort Fit</li><li><strong>Sleeves:</strong> Short Half Sleeves</li><li><strong>Pattern:</strong> Tropical Botanical Leaf Print</li><li><strong>Collar:</strong> Cuban / Camp Collar</li><li><strong>Fabric:</strong> Lightweight Rayon-Cotton Blend</li></ul><p><strong>CARE INSTRUCTIONS:</strong></p><ul><li>Machine wash cold inside out</li><li>Do not bleach</li><li>Iron on low heat</li></ul>`,
        summary: `• Fabric: Lightweight Rayon-Cotton Blend\n• Fit: Relaxed Casual Fit\n• Pattern: Tropical Botanical Leaf Print\n• Collar: Cuban / Camp Collar\n• Sleeves: Short Sleeves\n• Buttons: Tonal Matte Finish Buttons\n• Care: Machine Wash Cold, Hang to Dry`
    },
    '118b0a0e-6cc9-4384-8463-73798a41e55e': {
        description: `<p>A timeless mandatory essential for every man's wardrobe, this Formal White Shirt is designed to deliver crisp, professional sharpness all day long. Tailored from premium wrinkle-resistant cotton oxford weave with a structured spread collar, button cuffs, and a clean French seam finish.</p><ul><li><strong>Fit:</strong> Slim / Tailored Fit</li><li><strong>Sleeves:</strong> Long Sleeves with Adjustable Button Cuffs</li><li><strong>Pattern:</strong> Solid Crisp White</li><li><strong>Collar:</strong> Structured Spread Collar</li><li><strong>Occasion:</strong> Business, Office Wear, Interviews, &amp; Formal Dinners</li></ul><p><strong>COMPOSITION &amp; CARE:</strong></p><ul><li>Material: 100% Premium Combed Cotton</li><li>Machine wash warm with like colors</li><li>Warm iron while slightly damp for best results</li></ul>`,
        summary: `• Fabric: 100% Premium Combed Cotton Oxford\n• Fit: Slim Fit\n• Color: Crisp White\n• Collar: Structured Spread Collar\n• Sleeves: Full Sleeves with Adjustable Cuffs\n• Placket: Classic Button Placket\n• Care: Machine Wash Warm, Medium Iron`
    },
    'e1f00588-ed2b-4b62-86e0-4d27f692b0ea': {
        description: `<p>Add a modern sophisticated hue to your smart-casual collection with this Oxford Olive Shirt. Crafted from high-density cotton oxford fabric, this shirt features a button-down collar, buttoned cuffs, and a smooth chest patch pocket. Ideal for pairing with chinos, dark jeans, or layering under a blazer.</p><ul><li><strong>Fit:</strong> Modern Fit</li><li><strong>Sleeves:</strong> Full Sleeves</li><li><strong>Color:</strong> Olive Green</li><li><strong>Collar:</strong> Button-Down Collar</li><li><strong>Fabric:</strong> Breathable Cotton Oxford</li></ul><p><strong>CARE INSTRUCTIONS:</strong></p><ul><li>Machine wash cold with dark colors</li><li>Do not bleach</li><li>Tumble dry low or line dry</li></ul>`,
        summary: `• Fabric: 100% Cotton Oxford Weave\n• Fit: Modern Slim Fit\n• Color: Earthy Olive Green\n• Collar: Button-Down Collar\n• Sleeve: Full Sleeves\n• Pocket: Single Patch Chest Pocket\n• Care: Machine Wash Cold, Line Dry`
    },
    '6e437111-179f-4358-8a60-93911b7b3f2c': {
        description: `<p>Channel contemporary urban aesthetics with this Street Black Half Shirt. Featuring a sleek solid black design with minimalist street-style accents, short sleeves, and a sharp spread collar. Cut from breathable cotton twill for comfort and durability during day or night urban adventures.</p><ul><li><strong>Fit:</strong> Streetwear Boxy Fit</li><li><strong>Sleeves:</strong> Short Half Sleeves</li><li><strong>Color:</strong> Matte Black</li><li><strong>Collar:</strong> Spread Collar</li><li><strong>Pockets:</strong> Twin Chest Patch Pockets</li></ul><p><strong>CARE INSTRUCTIONS:</strong></p><ul><li>Machine wash cold, turn garment inside out</li><li>Do not bleach</li><li>Warm iron on reverse</li></ul>`,
        summary: `• Fabric: 100% Breathable Cotton Twill\n• Fit: Streetwear Boxy Fit\n• Color: Matte Black\n• Sleeves: Half Sleeves\n• Collar: Spread Collar\n• Pockets: Dual Utility Chest Pockets\n• Care: Machine Wash Cold Inside Out`
    },
    '3e170d22-92a3-4bd1-99b8-0616b2fce32d': {
        description: `<p>Refresh your festive apparel with the Womens Fancy Mint 3-Piece Lawn Set. Showcasing a soothing mint green canvas enriched with detailed floral embroidery, delicate lace borders, and paired with soft matching trousers and a coordinating sheer chiffon dupatta.</p><ul><li><strong>Package Includes:</strong> 3-Piece Suit (Kameez + Trousers + Dupatta)</li><li><strong>Shirt/Kameez:</strong> Mint Green Lawn Cotton with Neckline Embroidery</li><li><strong>Bottom/Trousers:</strong> Comfortable Solid Cotton Pants</li><li><strong>Dupatta:</strong> Soft Printed Chiffon Dupatta</li></ul><p><strong>CARE INSTRUCTIONS:</strong></p><ul><li>Soft hand wash in cold water</li><li>Do not tumble dry</li><li>Iron low on reverse side</li></ul>`,
        summary: `• Product Type: 3-Piece Women's Suit Set\n• Color: Mint Green & Pastel Accents\n• Fabric (Kameez): Premium Embroidered Lawn Cotton\n• Fabric (Salwar): Soft Breathable Cotton\n• Fabric (Dupatta): Printed Chiffon Dupatta\n• Occasion: Festive, Summer Gatherings & Parties\n• Care: Hand Wash Cold, Iron on Reverse`
    },
    '095e5f1a-cddb-4708-8a6b-eae6c5923d7b': {
        description: `<p>Radiate timeless sophistication with the <strong>Brown Gold 3-Piece Salwar Kameez Set</strong>. Beautifully styled in an opulent earthy brown palette accentuated with rich gold zari embroidery and delicate hand-embellished detailing along the neckline, daman, and sleeves. The outfit pairs a luxurious cotton-silk kameez with matching comfortable trousers and a gracefully draping organza dupatta adorned with intricate gold borders. Ideal for weddings, formal receptions, family celebrations, and evening parties.</p><ul><li><strong>Set Includes:</strong> 3-Piece Ensemble (Embroidered Kameez + Matching Trousers + Embellished Dupatta)</li><li><strong>Top (Kameez):</strong> Premium Cotton-Silk Blend with Zari &amp; Thread Embroidery</li><li><strong>Bottom (Salwar/Pants):</strong> Tailored Soft Cotton-Silk Trousers</li><li><strong>Dupatta:</strong> Sheer Lightweight Organza with Gilded Borders</li><li><strong>Color:</strong> Royal Brown with Antique Gold Accents</li><li><strong>Fit:</strong> Classic Straight Cut</li><li><strong>Available Sizes:</strong> S, M, L, XL, XXL</li></ul><p><strong>COMPOSITION &amp; CARE:</strong></p><ul><li>Fabric: Premium Cotton-Silk &amp; Organza</li><li>Wash Care: Dry clean only to preserve metallic threadwork</li><li>Ironing: Steam iron on low heat on reverse side</li><li>Storage: Store in a breathable garment bag</li></ul>`,
        summary: `• Product Type: 3-Piece Women's Salwar Kameez Set\n• Color: Royal Brown with Antique Gold Embroidery\n• Top Fabric: Luxury Cotton-Silk Blend with Detailed Zari Work\n• Bottom Fabric: Solid Dyed Cotton-Silk Trousers\n• Dupatta: Lightweight Organza with Embellished Border\n• Fit / Style: Elegant Straight Fit\n• Sizes: S, M, L, XL, XXL\n• Occasion: Weddings, Festive Gatherings & Formal Receptions\n• Care: Dry Clean Only`
    },
    '92e50240-e64c-4f24-bc91-85cc122b2f5b': {
        description: `<p>Elevate your traditional wardrobe with the <strong>Semi-Formal Panjabi</strong>, crafted for the modern gentleman who values elegance and comfort. Made from high-density, breathable combed cotton jacquard fabric with subtle self-textured weaving, this panjabi features an intricately embroidered mandarin collar, a neat button placket with metallic accent buttons, and practical dual side pockets. Designed to keep you sharp and relaxed through Jummah prayers, semi-formal dinners, cultural festivities, and Eid celebrations.</p><ul><li><strong>Fit:</strong> Regular / Tailored Fit</li><li><strong>Fabric:</strong> 100% Breathable Combed Cotton with Jacquard Texture</li><li><strong>Collar:</strong> Embroidered Mandarin / Band Collar</li><li><strong>Sleeves:</strong> Full Length with Clean Finished Cuffs</li><li><strong>Placket:</strong> Button Placket with Premium Accent Buttons</li><li><strong>Pockets:</strong> Dual Functional Side Seam Pockets</li><li><strong>Available Sizes:</strong> S, M, L, XL, XXL</li></ul><p><strong>COMPOSITION &amp; CARE:</strong></p><ul><li>Material: 100% Premium Combed Cotton</li><li>Wash: Gentle machine wash cold with similar colors</li><li>Detergent: Use mild liquid detergent; do not bleach</li><li>Iron: Warm iron on reverse side for a crisp look</li></ul>`,
        summary: `• Product Type: Men's Semi-Formal Panjabi\n• Fabric: 100% Premium Cotton Jacquard with Self Texture\n• Fit: Regular / Modern Fit\n• Collar: Mandarin / Band Collar with Subtle Embroidery\n• Sleeves: Full Sleeves\n• Pockets: Two Side Pockets\n• Sizes: S, M, L, XL, XXL\n• Occasion: Semi-Formal, Festive, Jummah & Cultural Gatherings\n• Care: Machine Wash Cold, Warm Iron on Reverse`
    },
    'd9b69c4f-36ff-4250-8501-4354c203f9ec': {
        description: `<p>Experience unmatched luxury with the <strong>Suffuse Naz Freeshia Festive Collection I</strong>. Crafted from high-grade organza and premium lawn-silk, this couture-inspired festive kurti boasts opulent resham thread embroidery, shimmering sequins, and floral laser-cut lace appliqu&eacute;s along the front neckline and hemline. Finished with scalloped sleeve borders and an elegant silhouette that exudes regal charm. A show-stopping statement piece designed for wedding festivities, Eid parties, and high-profile social galas.</p><ul><li><strong>Collection:</strong> Suffuse Naz Freeshia Festive Luxury Edition</li><li><strong>Garment Type:</strong> Designer Embroidered Kurti</li><li><strong>Fabric:</strong> Luxury Raw Silk &amp; Organza Overlay with Hand Embroidery</li><li><strong>Embellishments:</strong> Resham Threadwork, Sequins, Pearls &amp; Cutwork Lace</li><li><strong>Neckline:</strong> Intricately Embellished V-Neck / Split Collar</li><li><strong>Sleeves:</strong> Full Sleeves with Scalloped Embroidered Cuffs</li><li><strong>Available Sizes:</strong> S, M, L, XL, XXL</li></ul><p><strong>COMPOSITION &amp; CARE:</strong></p><ul><li>Material: Premium Silk-Organza Blend with Inner Lining</li><li>Wash Care: Strictly Dry Clean Only</li><li>Bleach: Do Not Bleach</li><li>Iron: Low steam iron on reverse side only; avoid direct heat on embellishments</li></ul>`,
        summary: `• Product Type: Designer Luxury Festive Kurti\n• Collection: Suffuse Naz Freeshia Festive Edition\n• Fabric: Premium Raw Silk & Organza with Soft Breathable Lining\n• Work / Detailing: Intricate Resham Embroidery, Sequins & Scalloped Cutwork Lace\n• Fit: Flowing Royal Silhouette\n• Sizes: S, M, L, XL, XXL\n• Occasion: Weddings, Gala Dinners, Eid & Festive Celebrations\n• Care: Strictly Dry Clean Only`
    }
};

// Generic Generator function based on product name/category for any other products
function generateFallbackDetails(product) {
    const name = product.name.trim();
    const mainCat = (product.mainCategoryName || '').toLowerCase();
    const firstCat = (product.firstCategoryName || '').toLowerCase();

    if (mainCat.includes('women') || firstCat.includes('lawn') || name.toLowerCase().includes('3 piece') || name.toLowerCase().includes('saree') || name.toLowerCase().includes('kurti')) {
        return {
            description: `<p>Enhance your wardrobe with the elegant <strong>${name}</strong>. Thoughtfully designed with high-quality fabrics, intricate detailing, and superior comfort. Perfect for traditional celebrations, festive gatherings, and elevated casual occasions.</p><ul><li><strong>Product Name:</strong> ${name}</li><li><strong>Style:</strong> Elegant Women's Apparel</li><li><strong>Fabric:</strong> Premium Soft Breathable Fabric</li><li><strong>Occasion:</strong> Festive, Party &amp; Casual Wear</li></ul><p><strong>CARE INSTRUCTIONS:</strong> Gentle hand wash or dry clean recommended. Dry flat in shade.</p>`,
            summary: `• Product: ${name}\n• Category: Women's Collection\n• Fabric: High-Quality Soft Fabric\n• Style: Contemporary & Traditional Blend\n• Care: Hand Wash Cold or Dry Clean`
        };
    } else {
        return {
            description: `<p>Upgrade your look with the classic <strong>${name}</strong>. Crafted from premium breathable cotton material, offering modern fitting, durable stitching, and all-day comfort for any event or daily wear.</p><ul><li><strong>Product Name:</strong> ${name}</li><li><strong>Fit:</strong> Modern / Regular Fit</li><li><strong>Material:</strong> 100% High-Grade Cotton</li><li><strong>Style:</strong> Versatile Men's Apparel</li></ul><p><strong>CARE INSTRUCTIONS:</strong> Machine wash cold with like colors. Warm iron when needed.</p>`,
            summary: `• Product: ${name}\n• Category: Men's Collection\n• Fabric: Premium Breathable Cotton\n• Fit: Regular / Modern Fit\n• Care: Machine Wash Cold, Iron Medium`
        };
    }
}

async function seedProducts() {
    const host = process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 3306;
    const username = process.env.DATABASE_USERNAME || process.env.DB_USER || 'root';
    const password = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || '';
    const database = process.env.DATABASE_NAME || process.env.DB_NAME || 'cloth';

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

    // Fetch all active products
    const products = await ds.query(`SELECT id, name, slug, mainCategoryName, firstCategoryName, description, summary FROM product WHERE isDeleted = 0 OR isDeleted IS NULL`);

    console.log(`📦 Found ${products.length} active products to process...`);

    let updatedCount = 0;

    for (const product of products) {
        let details = PRODUCT_DETAILS_BY_ID[product.id];
        if (!details) {
            console.log(`ℹ️ Generating tailored description & specifications for: "${product.name}" (${product.id})`);
            details = generateFallbackDetails(product);
        }

        const result = await ds.query(
            `UPDATE product SET description = ?, summary = ?, updatedAt = NOW() WHERE id = ?`,
            [details.description, details.summary, product.id]
        );

        if (result.affectedRows > 0) {
            updatedCount++;
            console.log(`  ✓ Updated: "${product.name}"`);
        }
    }

    console.log(`\n🎉 Successfully seeded description & specification data for ${updatedCount} / ${products.length} active products!`);

    await ds.destroy();
}

seedProducts().catch(err => {
    console.error('❌ Seeding Error:', err);
    process.exit(1);
});
