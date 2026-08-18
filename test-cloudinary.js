const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function test() {
  console.log("Cloudinary configuration:");
  console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
  console.log("API Key:", process.env.CLOUDINARY_API_KEY ? "CONFIGURED (masking)" : "MISSING");
  console.log("API Secret:", process.env.CLOUDINARY_API_SECRET ? "CONFIGURED (masking)" : "MISSING");

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("\n[ERROR] Missing one or more Cloudinary environment variables in .env!");
    return;
  }

  try {
    console.log("\nTesting upload to Cloudinary...");
    const res = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'test_connection',
          public_id: 'test_upload',
          resource_type: 'raw'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(Buffer.from("Hello Cloudinary connection test!"));
    });
    console.log("\n[SUCCESS] Cloudinary upload successful!");
    console.log("Uploaded Image URL:", res.secure_url);
  } catch (error) {
    console.error("\n[ERROR] Cloudinary upload failed! Details:");
    console.error(error.message || error);
  }
}

test();
