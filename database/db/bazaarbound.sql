-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               9.2.0 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.10.0.7000
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for bazaarbound
CREATE DATABASE IF NOT EXISTS `bazaarbound` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `bazaarbound`;

-- Dumping structure for table bazaarbound.blog
CREATE TABLE IF NOT EXISTS `blog` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `imageAltText` varchar(255) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `author` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.blog: ~0 rows (approximately)

-- Dumping structure for table bazaarbound.contact-page-cms
CREATE TABLE IF NOT EXISTS `contact-page-cms` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `pageTitle` varchar(255) NOT NULL,
  `pageSubTitle` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `formSectionTitleOne` varchar(255) NOT NULL,
  `formSectionTitleTwo` varchar(255) NOT NULL,
  `formSectionTitleThree` varchar(255) NOT NULL,
  `buttonText` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.contact-page-cms: ~1 rows (approximately)
INSERT INTO `contact-page-cms` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `pageTitle`, `pageSubTitle`, `phone`, `email`, `address`, `formSectionTitleOne`, `formSectionTitleTwo`, `formSectionTitleThree`, `buttonText`) VALUES
	('8`bazaar-bound-temp`bbe5d31-716c-474', '2025-05-13 10:23:07.127890', '2025-05-14 10:50:08.000000', 0, 'Get in Touch', 'Fill out the form below — our support team will get back to you within 1 business day.', '01946413146', 'sabbir@qligence.com', 'Safura Green, Dhanmondi, Dhaka', 'Let’s just have a conversation.', 'No pressure, no sales talk.', 'Sometimes connection is more than enough.', 'Send Message'),
	('8bbe5d31-716c-4745-9f58-86efab461716', '2025-05-13 10:23:07.127890', '2025-05-14 10:50:08.000000', 0, 'Get in Touch', 'Fill out the form below — our support team will get back to you within 1 business day.', '01946413146', 'sabbir@qligence.com', 'Safura Green, Dhanmondi, Dhaka', 'Let’s just have a conversation.', 'No pressure, no sales talk.', 'Sometimes connection is more than enough.', 'Send Message');

-- Dumping structure for table bazaarbound.contact-us
CREATE TABLE IF NOT EXISTS `contact-us` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `message` longtext NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.contact-us: ~1 rows (approximately)
INSERT INTO `contact-us` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `name`, `email`, `phone`, `message`) VALUES
	('d0f0a333-c773-4453-b5d3-2c3646d01b6e', '2025-05-06 09:31:41.443885', '2025-05-06 10:00:25.000000', 1, 'John Dev', 'john.dev@gmail.com', '01835404748', 'Since all my products are handmade, each piece is unique and there might be slight differences between each one.');

-- Dumping structure for table bazaarbound.contact-us-message
CREATE TABLE IF NOT EXISTS `contact-us-message` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `message` longtext NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.contact-us-message: ~1 rows (approximately)
INSERT INTO `contact-us-message` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `name`, `email`, `phone`, `message`) VALUES
	('ac4db8f3-ad88-4991-bc6a-54609a938bf0', '2025-05-24 10:22:55.716160', '2025-05-24 10:22:55.716160', 0, 'Jhon Dev', 'john.dev@gmail.com', '01946413146', 'Let’s just have a conversation.'),
	('fc43636e-a78f-4d21-83bc-eae61ab84e97', '2025-05-13 10:02:46.568032', '2025-05-14 06:22:24.000000', 1, 'Sabbir Hassan', 'sabbir@gmail.com', '01946413146', 'Let’s Talk. Not Everything Needs to be Transactional.');

-- Dumping structure for table bazaarbound.faq
CREATE TABLE IF NOT EXISTS `faq` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `question` varchar(255) NOT NULL,
  `answer` longtext NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.faq: ~3 rows (approximately)
INSERT INTO `faq` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `question`, `answer`) VALUES
	('0e51f7d2-0bb6-43c1-839d-e3f46f1e3c75', '2025-04-28 07:26:20.208250', '2025-04-28 07:26:20.208250', 0, 'Gift wrapping and packaging', 'Since I need to make sure the pottery you ordered arrives safe, it must have lots of bubble wraps surrounding it. This is the reason why It is very difficult to gift wrap your pottery. However, I am more than happy to add a hand written message from you attached to the present you bought. Please include the message in your note to Seller once you do the check out.'),
	('4f0c4e96-c3cc-4103-be9b-464f518d2f75', '2025-04-28 07:23:52.616580', '2025-04-28 07:25:14.000000', 0, 'Care instructions', 'All my pottery is made from very high quality stoneware clay, to make sure they can easily withstand everyday use. Working many years with high- capacity restaurant I got all assurance that they are strong and pass the needed tests . All my pottery is microwave and dishwasher safe. The pieces can be heated in the oven with a maximum temperature of 120°C/ 248°F.'),
	('ef2a1e08-cc32-4a08-b195-060c7bfbcd34', '2025-04-28 07:27:15.508302', '2025-04-28 07:27:15.508302', 0, 'Natural variations', 'Since all my products are handmade, each piece is unique and there might be slight differences between each one.');

-- Dumping structure for table bazaarbound.first-category
CREATE TABLE IF NOT EXISTS `first-category` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `bannerImage` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `mainCategoryId` varchar(255) NOT NULL,
  `mainCategoryName` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.first-category: ~4 rows (approximately)
INSERT INTO `first-category` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `name`, `slug`, `bannerImage`, `status`, `mainCategoryId`, `mainCategoryName`) VALUES
	('0f7c027d-45bb-4d41-8f6d-4fb9024df270', '2025-03-19 07:25:41.179996', '2025-03-19 07:32:27.996282', 0, 'Religious Book', 'religious-book', 'https://cdn.bazaarbound.com/first-category/220d56ab-2335-4969-9920-9bd5613fad49.jpeg', 1, 'c9727476-7894-4588-a787-1d46a9d7bbc3', 'E-Book'),
	('b568980d-9a85-4428-b65a-9429bbb9c5b1', '2025-03-23 07:15:25.058875', '2025-05-12 05:09:21.948180', 0, 'Painting', 'painting', 'https://cdn.bazaarbound.com/first-category/703cff46-dd2f-404b-9f7e-c591db78ee48.jpeg', 1, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork'),
	('d6ebc43a-b050-448f-808a-d62714585175', '2025-03-18 08:58:44.790852', '2025-04-16 13:09:02.378275', 0, 'Home Decor', 'home-decor', 'https://cdn.bazaarbound.com/first-category/f239c335-37a4-4fbb-814e-fd53f445f065.jpeg', 1, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork'),
	('ed2a1dec-1b77-4443-a32c-7ffe7546a796', '2025-03-19 07:05:11.254369', '2025-03-19 07:05:11.254369', 0, 'Horror Story', 'horror-story', 'https://cdn.bazaarbound.com/first-category/15686da0-0634-43cf-b35a-4af11fb773e1.jpeg', 1, 'c9727476-7894-4588-a787-1d46a9d7bbc3', 'E-Book');

-- Dumping structure for table bazaarbound.header-footer-cms
CREATE TABLE IF NOT EXISTS `header-footer-cms` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `helpline` varchar(255) DEFAULT NULL,
  `copyrightText` varchar(255) DEFAULT NULL,
  `contactEmail` varchar(255) DEFAULT NULL,
  `contactPhone` varchar(255) DEFAULT NULL,
  `contactAddress` varchar(255) DEFAULT NULL,
  `headerLogo` varchar(255) DEFAULT NULL,
  `footerLogo` varchar(255) DEFAULT NULL,
  `footerDescription` text,
  `bannerText` text,
  `footerSectionTwo` json DEFAULT NULL,
  `footerSectionThree` json DEFAULT NULL,
  `footerSectionTwoTitle` varchar(255) DEFAULT NULL,
  `footerSectionThreeTitle` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.header-footer-cms: ~1 rows (approximately)
INSERT INTO `header-footer-cms` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `helpline`, `copyrightText`, `contactEmail`, `contactPhone`, `contactAddress`, `headerLogo`, `footerLogo`, `footerDescription`, `bannerText`, `footerSectionTwo`, `footerSectionThree`, `footerSectionTwoTitle`, `footerSectionThreeTitle`) VALUES
	('296be580-b3de-4124-a8b8-0310c0bddf33', '2025-05-17 10:30:28.669737', '2025-05-28 06:29:21.000000', 0, '+880 1810 172434', '© 2025 Bazaar Bound. All rights reserved.', 'info@bazaarbound.com', '+880 1810 172434', 'Safura Green, Dhanmondi, Dhaka', 'https://cdn.bazaarbound.com/header-footer/0e285172-4434-4060-8e19-39d36d5a09a4.svg', 'https://cdn.bazaarbound.com/header-footer/d2210a0f-45a9-44eb-bcec-fbb9ce3d7207.svg', 'Your one-stop marketplace for buying and selling. Connect with buyers and sellers, discover great deals, and make your shopping experience seamless.', ' Welcome to Bazaar Bound', '"[{\\"value\\":\\"Home\\",\\"link\\":\\"/\\"},{\\"value\\":\\"Contact\\",\\"link\\":\\"/contact\\"},{\\"value\\":\\"Products\\",\\"link\\":\\"/shop\\"},{\\"value\\":\\"Categories\\",\\"link\\":\\"/all-categories\\"}]"', '"[{\\"value\\":\\"Return Policy\\",\\"link\\":\\"/exchange-policy\\"},{\\"value\\":\\"Privacy Policy\\",\\"link\\":\\"/privacy-policy\\"},{\\"value\\":\\"Terms & Conditions\\",\\"link\\":\\"/terms-conditions\\"}]"', 'Quick Links', 'Policy');

-- Dumping structure for table bazaarbound.hero-slider
CREATE TABLE IF NOT EXISTS `hero-slider` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `image` varchar(255) NOT NULL,
  `link` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.hero-slider: ~2 rows (approximately)
INSERT INTO `hero-slider` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `image`, `link`, `status`) VALUES
	('214aa111-8ce9-4f19-aa3b-9b59cfe0db5a', '2025-04-21 06:03:39.473706', '2025-04-21 06:03:39.473706', 0, 'https://cdn.bazaarbound.com/hero-slider/99979a6d-0088-4fff-b063-18f164448d16.jpeg', '/shop', 1),
	('88ee9cc5-a11a-4cb5-ba3b-a44439ecc70e', '2025-04-21 06:03:54.567303', '2025-04-21 06:03:54.567303', 0, 'https://cdn.bazaarbound.com/hero-slider/c00619aa-d356-4726-a2d1-0b6cb43bbbe9.jpeg', '/shop', 1);

-- Dumping structure for table bazaarbound.home-page-cms
CREATE TABLE IF NOT EXISTS `home-page-cms` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `categorySectionTitle` varchar(255) NOT NULL,
  `bannerImage` varchar(255) NOT NULL,
  `productSectionOneTitle` varchar(255) NOT NULL,
  `isProductSectionOneVisible` tinyint NOT NULL DEFAULT '1',
  `productSectionTwoTitle` varchar(255) NOT NULL,
  `isProductSectionTwoVisible` tinyint NOT NULL DEFAULT '1',
  `productSectionOneFontColor` varchar(255) NOT NULL,
  `productSectionOneBackgroundColor` varchar(255) NOT NULL,
  `productSectionTwoFontColor` varchar(255) NOT NULL,
  `productSectionTwoBackgroundColor` varchar(255) NOT NULL,
  `productSectionThreeTitle` varchar(255) NOT NULL,
  `isProductSectionThreeVisible` tinyint NOT NULL DEFAULT '1',
  `productSectionThreeFontColor` varchar(255) NOT NULL,
  `productSectionThreeBackgroundColor` varchar(255) NOT NULL,
  `productSectionFourTitle` varchar(255) NOT NULL,
  `isProductSectionFourVisible` tinyint NOT NULL DEFAULT '1',
  `productSectionFourFontColor` varchar(255) NOT NULL,
  `productSectionFourBackgroundColor` varchar(255) NOT NULL,
  `productSectionFiveTitle` varchar(255) NOT NULL,
  `isProductSectionFiveVisible` tinyint NOT NULL DEFAULT '1',
  `productSectionFiveFontColor` varchar(255) NOT NULL,
  `productSectionFiveBackgroundColor` varchar(255) NOT NULL,
  `productSectionSixTitle` varchar(255) NOT NULL,
  `isProductSectionSixVisible` tinyint NOT NULL DEFAULT '1',
  `productSectionSixFontColor` varchar(255) NOT NULL,
  `productSectionSixBackgroundColor` varchar(255) NOT NULL,
  `isCategorySectionVisible` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.home-page-cms: ~1 rows (approximately)
INSERT INTO `home-page-cms` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `categorySectionTitle`, `bannerImage`, `productSectionOneTitle`, `isProductSectionOneVisible`, `productSectionTwoTitle`, `isProductSectionTwoVisible`, `productSectionOneFontColor`, `productSectionOneBackgroundColor`, `productSectionTwoFontColor`, `productSectionTwoBackgroundColor`, `productSectionThreeTitle`, `isProductSectionThreeVisible`, `productSectionThreeFontColor`, `productSectionThreeBackgroundColor`, `productSectionFourTitle`, `isProductSectionFourVisible`, `productSectionFourFontColor`, `productSectionFourBackgroundColor`, `productSectionFiveTitle`, `isProductSectionFiveVisible`, `productSectionFiveFontColor`, `productSectionFiveBackgroundColor`, `productSectionSixTitle`, `isProductSectionSixVisible`, `productSectionSixFontColor`, `productSectionSixBackgroundColor`, `isCategorySectionVisible`) VALUES
	('b68bc836-d565-4b49-859e-c2b02df8d33e', '2025-05-07 09:58:28.789277', '2025-05-28 07:14:46.000000', 0, 'Product Category', 'https://cdn.bazaarbound.com/home-page/ef974563-c770-4f43-962e-4931589eb009.jpeg', '', 1, '', 1, '', '', '', '', '', 1, '', '', '', 1, '', '', '', 1, '', '', '', 1, '', '', 1);

-- Dumping structure for table bazaarbound.main-category
CREATE TABLE IF NOT EXISTS `main-category` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `image` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `bannerImage` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.main-category: ~8 rows (approximately)
INSERT INTO `main-category` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `name`, `slug`, `image`, `status`, `bannerImage`) VALUES
	('13d563d8-87fc-4789-a9b5-21f00ad20803', '2025-04-17 05:52:55.936603', '2025-04-17 05:52:55.936603', 0, 'Photography', 'photography', 'https://cdn.bazaarbound.com/main-category/0233b966-a93e-4ac8-9833-6a0fb73f2e86.png', 1, 'https://cdn.bazaarbound.com/main-category/c803a3bf-0846-4bac-a05a-f1049a3b2b31.jpeg'),
	('4983f912-5b22-4ee4-98bd-9f135387c96c', '2025-03-18 08:42:49.517158', '2025-04-16 09:17:05.000000', 0, 'Artwork', 'artwork', 'https://cdn.bazaarbound.com/main-category/69d57940-8dac-48b9-b185-7bf98803e5c4.png', 1, 'https://cdn.bazaarbound.com/main-category/80e6ccad-ca8c-4c1c-a4a2-8d7cbb30f986.jpeg'),
	('49a5d6bc-5a33-4411-833a-d2e11edb37f4', '2025-04-17 05:53:32.503053', '2025-04-17 05:53:32.503053', 0, 'Graphics', 'graphics', 'https://cdn.bazaarbound.com/main-category/76879842-0282-42ab-94c6-7f1924b0a786.png', 1, 'https://cdn.bazaarbound.com/main-category/285e727b-0184-48c1-a40b-fe6702aa7939.jpeg'),
	('6035814f-88f4-4200-a4b2-27f4e8a469ad', '2025-04-16 06:04:51.346251', '2025-04-16 09:17:17.000000', 0, 'Audio', 'audio', 'https://cdn.bazaarbound.com/main-category/1edf2469-911c-4075-ae91-17abb58571c0.png', 1, 'https://cdn.bazaarbound.com/main-category/2f140520-9f58-47ae-8e24-040ffe0dd7f3.jpeg'),
	('60bc5f23-3c7b-4735-95f5-9bd4b73a54b3', '2025-04-17 05:55:11.465743', '2025-04-17 05:55:11.465743', 0, 'Artificial Intelligence', 'artificial-intelligence', 'https://cdn.bazaarbound.com/main-category/71a0f993-653b-4390-8b9f-61fd5fb3fad0.png', 1, 'https://cdn.bazaarbound.com/main-category/24a67c2c-8101-4908-b9ee-8ba662705fac.jpeg'),
	('74b3b0ae-f990-490d-8395-3510e79a841c', '2025-04-17 05:54:08.111255', '2025-04-17 05:54:08.111255', 0, 'Social Media Templates', 'social-media-templates', 'https://cdn.bazaarbound.com/main-category/0f1f7358-3349-4085-bff9-e6357bdd1875.png', 1, 'https://cdn.bazaarbound.com/main-category/e9df41e0-daa4-4b01-af1b-00a5b6779f73.jpeg'),
	('c6d930af-23b4-41b0-bc64-0bfea2fdb5a0', '2025-04-17 05:53:45.786518', '2025-04-17 05:53:45.786518', 0, 'Gadget', 'gadget', 'https://cdn.bazaarbound.com/main-category/2f70200a-fbaf-4c1b-a527-4bccbefe883d.png', 1, 'https://cdn.bazaarbound.com/main-category/d80779b9-163b-4a80-8f5a-831a8ddbc26e.jpeg'),
	('c9727476-7894-4588-a787-1d46a9d7bbc3', '2025-03-19 07:04:12.421783', '2025-04-16 09:17:25.000000', 0, 'E-Book', 'e-book', 'https://cdn.bazaarbound.com/main-category/4f4fa069-b8f3-4a61-89c2-88ff46503673.png', 1, 'https://cdn.bazaarbound.com/main-category/748d5f78-6c47-4346-b3d3-7669b7becd6e.jpeg'),
	('fcf18716-2ea8-4fe8-a833-4459120d5079', '2025-04-17 05:53:16.215764', '2025-04-17 05:53:16.215764', 0, 'Developers', 'developers', 'https://cdn.bazaarbound.com/main-category/c571666c-89ce-4732-9f10-0750bb473dd4.png', 1, 'https://cdn.bazaarbound.com/main-category/6774dd7d-d21c-43b7-8f82-0eb0681df155.jpeg');

-- Dumping structure for table bazaarbound.order-summary
CREATE TABLE IF NOT EXISTS `order-summary` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `productId` varchar(255) NOT NULL,
  `productName` varchar(255) NOT NULL,
  `productImage` varchar(255) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL,
  `orderId` varchar(255) NOT NULL,
  `vendorId` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_949969bd95e465fd7d9f4e68839` (`orderId`),
  CONSTRAINT `FK_949969bd95e465fd7d9f4e68839` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.order-summary: ~0 rows (approximately)

-- Dumping structure for table bazaarbound.orders
CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `orderId` varchar(255) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `paymentIntentId` varchar(255) DEFAULT NULL,
  `paymentMethod` varchar(255) DEFAULT 'COD',
  `subtotal` decimal(10,2) DEFAULT NULL,
  `deliveryCharge` decimal(10,2) NOT NULL DEFAULT '0.00',
  `totalAmount` decimal(10,2) NOT NULL,
  `currency` varchar(255) NOT NULL,
  `shippingAddress` json DEFAULT NULL,
  `specialNote` text DEFAULT NULL,
  `courierName` varchar(255) DEFAULT NULL,
  `trackingId` varchar(255) DEFAULT NULL,
  `courierTrackingLink` varchar(255) DEFAULT NULL,
  `idempotencyKey` varchar(255) DEFAULT NULL,
  `statusHistory` json DEFAULT NULL,
  `status` enum('Order Placed','Preparing Order','Loaded for Delivery','Handed Over to Courier','Out for Delivery','Delivered','Cancelled','Returned','Pending','Completed','Failed') NOT NULL DEFAULT 'Order Placed',
  `paymentStatus` enum('Pending','Paid','Unpaid','Failed') NOT NULL DEFAULT 'Pending',
  PRIMARY KEY (`id`),
  KEY `FK_151b79a83ba240b0cb31b2302d1` (`userId`),
  CONSTRAINT `FK_151b79a83ba240b0cb31b2302d1` FOREIGN KEY (`userId`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.orders: ~1 rows (approximately)

-- Dumping structure for table bazaarbound.privacy-policy-cms
CREATE TABLE IF NOT EXISTS `privacy-policy-cms` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.privacy-policy-cms: ~0 rows (approximately)
INSERT INTO `privacy-policy-cms` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `title`, `description`) VALUES
	('105bdddb-9459-405b-84e1-d9118fcc22bd', '2025-05-25 09:07:35.127503', '2025-05-25 09:07:35.127503', 0, 'sdfsdfsdfasdfasdfasfasdfasdfasdfasdfsdfsdf', '<p>sdfsadfasdf</p>');

-- Dumping structure for table bazaarbound.product
CREATE TABLE IF NOT EXISTS `product` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `featuredImage` varchar(255) DEFAULT NULL,
  `description` longtext,
  `videoUrl` varchar(255) DEFAULT NULL,
  `summary` longtext,
  `price` float NOT NULL,
  `cost` float DEFAULT NULL,
  `discountType` varchar(255) DEFAULT NULL,
  `discountAmount` float DEFAULT NULL,
  `mainCategoryId` varchar(255) NOT NULL,
  `mainCategoryName` varchar(255) NOT NULL,
  `firstCategoryId` varchar(255) DEFAULT NULL,
  `firstCategoryName` varchar(255) DEFAULT NULL,
  `secondCategoryId` varchar(255) DEFAULT NULL,
  `secondCategoryName` varchar(255) DEFAULT NULL,
  `thirdCategoryId` varchar(255) DEFAULT NULL,
  `thirdCategoryName` varchar(255) DEFAULT NULL,
  `vendorId` varchar(255) NOT NULL,
  `vendorName` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  `isProductSectionOne` tinyint NOT NULL DEFAULT '0',
  `isProductSectionTwo` tinyint NOT NULL DEFAULT '0',
  `isProductSectionThree` tinyint NOT NULL DEFAULT '0',
  `fileUrl` varchar(255) DEFAULT NULL,
  `isProductSectionFour` tinyint NOT NULL DEFAULT '0',
  `isProductSectionFive` tinyint NOT NULL DEFAULT '0',
  `isProductSectionSix` tinyint NOT NULL DEFAULT '0',
  `rating` float DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.product: ~15 rows (approximately)
INSERT INTO `product` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `name`, `slug`, `sku`, `featuredImage`, `description`, `videoUrl`, `summary`, `price`, `cost`, `discountType`, `discountAmount`, `mainCategoryId`, `mainCategoryName`, `firstCategoryId`, `firstCategoryName`, `secondCategoryId`, `secondCategoryName`, `thirdCategoryId`, `thirdCategoryName`, `vendorId`, `vendorName`, `status`, `isProductSectionOne`, `isProductSectionTwo`, `isProductSectionThree`, `fileUrl`, `isProductSectionFour`, `isProductSectionFive`, `isProductSectionSix`, `rating`) VALUES
	('14280d34-d68e-4988-bfe7-aafcec21b049', '2025-04-17 04:36:20.615505', '2025-05-25 05:02:41.740099', 0, 'Green Forest Painting', 'green-forest-painting', '01855188', 'https://cdn.bazaarbound.com/product/157cb59a-2be7-4c71-9de2-bdb8ce4e577f.png', 'Custom Creations:\nIf this original piece is sold, a new painting will be crafted in a similar style and color palette. While each handmade item may display subtle variations, we guarantee that you will receive the same high quality and beauty as depicted in the photos.\n\nPersonalized Process:\nThroughout the creation of your painting, we will share photos and videos, inviting your feedback on colors and details. We strive for your complete satisfaction and will only ship the artwork once you are thrilled with the final result.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Craftsmanship: handmade oil painting on canvas\n2. Material: high-grade acrylic paint, professional canvas.\n3. The painting come with extra 2-3 inch white border around for stretching or framing.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 0, 1, 0, NULL, 0, 0, 0, 0),
	('151a06a0-b4bb-48b1-819c-ae4e7432ad86', '2025-04-17 04:25:16.928799', '2025-05-25 05:02:40.768984', 0, 'Flower Oil Painting on Canva', 'flower-oil-painting-on-canva', '14990054', 'https://cdn.bazaarbound.com/product/1371cc48-0f7f-4ab1-9da5-10e5badee931.png', 'Custom Creations:\nIf this original piece is sold, a new painting will be crafted in a similar style and color palette. While each handmade item may display subtle variations, we guarantee that you will receive the same high quality and beauty as depicted in the photos.\n\nPersonalized Process:\nThroughout the creation of your painting, we will share photos and videos, inviting your feedback on colors and details. We strive for your complete satisfaction and will only ship the artwork once you are thrilled with the final result.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Craftsmanship: handmade oil painting on canvas\n2. Material: high-grade acrylic paint, professional canvas.\n3. The painting come with extra 2-3 inch white border around for stretching or framing.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 0, 1, 0, NULL, 0, 0, 0, 0),
	('34be6de0-be19-484c-8c10-dbb4ad3ea528', '2025-04-07 06:06:14.610948', '2025-05-25 05:02:39.821210', 0, 'Mon Amour Poster', 'mon-amour-poster', '47988756', 'https://cdn.bazaarbound.com/product/fdf2f2a1-2eda-4a9b-81a4-c06b6acd645d.png', 'This bold, romantic piece features the phrase "Mon Amour" in striking white typography against a passionate red background, accented with a delicate white lipstick kiss.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. High-quality 300 dpi high resolution printable art for instant download.\r\n2. Available in multiple sizes to suit your space.\r\n3. Download now and start decorating today!.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 0, 1, 0, NULL, 0, 0, 0, 0),
	('357cd1cb-386b-49e7-ba10-37822a1c68fc', '2025-04-17 04:39:18.955965', '2025-05-25 05:02:38.906744', 0, 'Beach Painting Textured Wall Art', 'beach-painting-textured-wall-art', '90439504', 'https://cdn.bazaarbound.com/product/25c24058-0183-4b99-a76d-3f8d1ba58582.png', 'Custom Creations:\nIf this original piece is sold, a new painting will be crafted in a similar style and color palette. While each handmade item may display subtle variations, we guarantee that you will receive the same high quality and beauty as depicted in the photos.\n\nPersonalized Process:\nThroughout the creation of your painting, we will share photos and videos, inviting your feedback on colors and details. We strive for your complete satisfaction and will only ship the artwork once you are thrilled with the final result.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Craftsmanship: handmade oil painting on canvas\n2. Material: high-grade acrylic paint, professional canvas.\n3. The painting come with extra 2-3 inch white border around for stretching or framing.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 0, 1, 0, NULL, 0, 0, 0, 0),
	('48b91a5c-7a39-4829-9111-d23a4a288a69', '2025-04-17 04:08:38.075121', '2025-05-25 05:02:37.795430', 0, 'Minimalist Ink Painting of Sunrise', 'minimalist-ink-painting-of-sunrise', '56298967', 'https://cdn.bazaarbound.com/product/1157f054-796b-44f9-9a0b-db3b4eba3338.png', 'A stunning ink painting featuring a minimalist sunrise. The composition depicts a beach with tropical trees, and sea waves on a sunny day, creating a serene and simplistic atmosphere. The artwork is executed in a single color palette of green and orange, which adds to its unique charm. The ink painting technique used in the painting gives the scene a sense of depth, to create a captivating, dual tone landscape masterpiece.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. High-quality 300 dpi high resolution printable art for instant download.\n2. Available in multiple sizes to suit your space.\n3. Download now and start decorating today!.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 0, 1, 0, NULL, 0, 0, 0, 0),
	('4f61cc8b-716a-4897-b0f7-de22021b73b8', '2025-04-16 12:37:17.854872', '2025-05-25 05:02:34.206121', 0, 'LOVE Typography Poster', 'love-typography-poster', '17317996', 'https://cdn.bazaarbound.com/product/e23e6cbd-96ac-4a96-bd3b-14dacefdceef.png', 'Featuring options with uplifting quotes and beautifully crafted designs, these prints serve as a daily reminder of positivity and inspiration. Available in multiple sizes and orientations (horizontal and vertical), they’re versatile enough to fit any space or decor.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Print only. The frame is not included.\n2. Multiple size options for the perfect fit.\n3. Horizontal and vertical layouts to suit your wall space.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 1, 1, 1, NULL, 0, 0, 0, 0),
	('5c3d38c2-9de2-45cc-bd07-40c0ca636b3e', '2025-04-16 12:28:33.001846', '2025-05-25 05:02:33.498015', 0, 'How lucky are we?', 'how-lucky-are-we', '29195952', 'https://cdn.bazaarbound.com/product/7d02c781-e4e3-4d6e-ad36-b9cef27073b0.png', 'This print features a bold, deep red background that commands attention and provides a dramatic contrast to the white handwritten-style typography that asks, "How lucky are we?". It\'s an invitation to pause and consider the good in life, making it a perfect addition to any living space or office that needs a touch of inspiration.\n\nIdeal for those who appreciate art that not only decorates but also provokes thought and gratitude. This piece would be particularly compelling in a cozy reading corner or a personal workspace, reminding you daily of the little blessings.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', 'The purchase includes downloadable files only. No physical product is provided.\nCopyrights are retained by the creator. Redistribution or commercial use without prior permission is prohibited.\nThe purchase is for personal use only. All sales on digital files are final.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 1, 1, 1, NULL, 0, 0, 0, 0),
	('6101dbcc-2112-499c-a71b-6c4730fab9cb', '2025-04-17 04:32:48.998917', '2025-05-25 05:02:32.253316', 0, 'Abstract Floral Textured Wall Art', 'abstract-floral-textured-wall-art', '89721457', 'https://cdn.bazaarbound.com/product/f4950910-1cea-4185-aaae-2701deff6e2b.png', 'Custom Creations:\nIf this original piece is sold, a new painting will be crafted in a similar style and color palette. While each handmade item may display subtle variations, we guarantee that you will receive the same high quality and beauty as depicted in the photos.\n\nPersonalized Process:\nThroughout the creation of your painting, we will share photos and videos, inviting your feedback on colors and details. We strive for your complete satisfaction and will only ship the artwork once you are thrilled with the final result.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Craftsmanship: handmade oil painting on canvas\n2. Material: high-grade acrylic paint, professional canvas.\n3. The painting come with extra 2-3 inch white border around for stretching or framing.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2', 'Shihan ', 1, 1, 1, 1, NULL, 0, 0, 0, 0),
	('616fdb02-a926-44f9-aa8d-2a9fc9dfdd8f', '2025-04-17 04:27:48.118701', '2025-05-25 05:03:31.540243', 0, 'Creamy Textured Wall Art', 'creamy-textured-wall-art', '33669043', 'https://cdn.bazaarbound.com/product/234db427-1ea1-46f5-8845-b7e7148b7fb9.png', 'Custom Creations:\nIf this original piece is sold, a new painting will be crafted in a similar style and color palette. While each handmade item may display subtle variations, we guarantee that you will receive the same high quality and beauty as depicted in the photos.\n\nPersonalized Process:\nThroughout the creation of your painting, we will share photos and videos, inviting your feedback on colors and details. We strive for your complete satisfaction and will only ship the artwork once you are thrilled with the final result.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Craftsmanship: handmade oil painting on canvas\n2. Material: high-grade acrylic paint, professional canvas.\n3. The painting come with extra 2-3 inch white border around for stretching or framing.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060', 'Zubayer Hassan', 1, 1, 1, 1, NULL, 0, 0, 0, 0),
	('655769c2-e037-42db-b8f2-9277d5e337ef', '2025-04-17 04:37:51.882562', '2025-05-25 05:03:30.294770', 0, 'Ocean Waves Art', 'ocean-waves-art', '36497561', 'https://cdn.bazaarbound.com/product/949c22e4-86a7-4327-a035-e53c4c6bce01.png', 'Custom Creations:\nIf this original piece is sold, a new painting will be crafted in a similar style and color palette. While each handmade item may display subtle variations, we guarantee that you will receive the same high quality and beauty as depicted in the photos.\n\nPersonalized Process:\nThroughout the creation of your painting, we will share photos and videos, inviting your feedback on colors and details. We strive for your complete satisfaction and will only ship the artwork once you are thrilled with the final result.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Craftsmanship: handmade oil painting on canvas\n2. Material: high-grade acrylic paint, professional canvas.\n3. The painting come with extra 2-3 inch white border around for stretching or framing.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060', 'Zubayer Hassan', 1, 1, 1, 1, NULL, 0, 0, 0, 0),
	('95abf6c5-f577-4d45-843a-fb36d501dfd0', '2025-04-17 04:14:05.601121', '2025-05-25 05:03:29.395717', 0, 'Original Desert Cactus Art', 'original-desert-cactus-art', '46766233', 'https://cdn.bazaarbound.com/product/73c2feab-9c64-4f7c-a338-216c217429f9.png', 'Desert Garden is an artwork that skillfully blends the arid desert with the wonders of life. With the artist\'s masterful technique, the thick texture of the oil painting creates a three-dimensional texture of cacti and wildflowers, emanating the beauty of the desert and the vitality of wildflowers amidst interplay of light and shadow. Rich colors combine with the soft glow of the sunset, providing a serene and expansive visual experience. A classic mountain backdrop and ethereal clouds offer a sense of peace and the yearning for distant places to the viewer. This piece is not only suitable for hanging in living rooms, bedrooms, and other settings as decor but also a prime choice for art collectors. It is more than just a painting; it is a deposit of the artist\'s emotions and a comfort to the viewer\'s soul, reflecting the diverse value and profound connotations of modern art.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. High-quality 300 dpi high resolution printable art for instant download.\n2. Available in multiple sizes to suit your space.\n3. Download now and start decorating today!.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060', 'Zubayer Hassan', 1, 1, 0, 1, NULL, 0, 0, 0, 0),
	('c3ea99d1-5558-47b8-83ed-67adeb6797da', '2025-04-07 05:54:44.123091', '2025-05-25 05:03:28.317048', 0, 'Forest Wall Art', 'forest-wall-art', '32288789', 'https://cdn.bazaarbound.com/product/6d151b41-f5c2-494c-a721-6983f9adba78.png', 'A masterfully detailed Renaissance oil painting of a forest at twilight, where the sun\'s last rays filter through ancient trees. Every leaf and branch is rendered with precision. A small, hidden pond reflects the warm tones of the fading sun, while misty outlines of distant trees fade into the soft horizon. The scene captures a sense of mystery and serenity, blending realism with subtle atmospheric depth.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Stunning oil painting of a forest wall art\n2. High-quality 300 dpi high resolution printable art for instant download\n3. Available in multiple sizes to suit your space\n4. Download now and start decorating today!', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'd6ebc43a-b050-448f-808a-d62714585175', 'Home Decor', NULL, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060', 'Zubayer Hassan', 1, 1, 0, 1, NULL, 0, 0, 0, 0),
	('d8aec6d4-27e1-48d3-a34d-9edfd36b5dd6', '2025-04-17 04:00:31.503540', '2025-05-25 05:03:27.620150', 0, 'Sunset Beach Painting', 'sunset-beach-painting', '99081280', 'https://cdn.bazaarbound.com/product/26afeb40-9723-418b-babf-c3f101887103.png', 'A watercolor sunset beach painting depicting a sky painted with warm hues of orange, pink, and purple. The silhouette of palm trees stands tall against the sky. In the foreground, the sandy beach meets the ocean water. The water is calm and reflects the sky. The horizon line separates the sky and the water. The overall image has a serene atmosphere.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Stunning watercolor painting of a sunset at the beach.\n2. High-quality 300 dpi high resolution printable art for instant download.\n3. Available in multiple sizes to suit your space.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'b568980d-9a85-4428-b65a-9429bbb9c5b1', 'Painting', NULL, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060', 'Zubayer Hassan', 1, 1, 0, 1, NULL, 0, 0, 0, 0),
	('dde8a36e-03f3-42e8-b55d-addcbca6c2b1', '2025-04-07 06:13:04.047280', '2025-05-25 05:03:26.965213', 0, 'Gold Handmade Ceramic Mug', 'gold-handmade-ceramic-mug', '20844027', 'https://cdn.bazaarbound.com/product/f4701408-a80a-4085-9626-69db6fb13cfa.png', 'Imagine starting your morning with a cup of coffee in a handcrafted ceramic mug, adorned with 22k gold accent mug details that shimmer in the light. Every sip feels like a moment of luxury, as the smooth handmade to-go cup fits perfectly in your hands. Each unique design, from the whimsical bunny to the graceful butterfly, brings a little joy to your daily routine.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Stoneware – Known for its durability and elegant finish.\n2. High-Quality Glaze Paint – Gives a smooth, glossy, and protective coat.\n3. 24K Genuine Gold Paint – Adds an exquisite touch of luxury.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'b568980d-9a85-4428-b65a-9429bbb9c5b1', 'Painting', NULL, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060', 'Zubayer Hassan', 1, 1, 0, 1, NULL, 0, 0, 0, 0),
	('fca11f48-2b7f-48e3-b295-224a7404e9f4', '2025-04-17 04:21:31.507953', '2025-05-25 05:03:26.180821', 0, 'Floral Oil Painting on Canvas', 'floral-oil-painting-on-canvas', '45054023', 'https://cdn.bazaarbound.com/product/23e66fca-f26a-4c36-8065-c232b97c160c.png', 'Custom Creations:\nIf this original piece is sold, a new painting will be crafted in a similar style and color palette. While each handmade item may display subtle variations, we guarantee that you will receive the same high quality and beauty as depicted in the photos.\n\nPersonalized Process:\nThroughout the creation of your painting, we will share photos and videos, inviting your feedback on colors and details. We strive for your complete satisfaction and will only ship the artwork once you are thrilled with the final result.', 'https://www.youtube.com/watch?v=S9atRW1DgbQ', '1. Craftsmanship: handmade oil painting on canvas\n2. Material: high-grade acrylic paint, professional canvas.\n3. The painting come with extra 2-3 inch white border around for stretching or framing.', 1, NULL, NULL, NULL, '4983f912-5b22-4ee4-98bd-9f135387c96c', 'Artwork', 'b568980d-9a85-4428-b65a-9429bbb9c5b1', 'Painting', NULL, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060', 'Zubayer Hassan', 1, 1, 0, 1, NULL, 0, 0, 0, 0);

-- Dumping structure for table bazaarbound.product-image-gallery
CREATE TABLE IF NOT EXISTS `product-image-gallery` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `productId` varchar(255) NOT NULL,
  `imageUrl` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.product-image-gallery: ~29 rows (approximately)
INSERT INTO `product-image-gallery` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `productId`, `imageUrl`) VALUES
	('0ffb0319-a42b-4cf9-aaa8-d87b26cfd9e9', '2025-04-16 12:37:20.245773', '2025-04-16 12:37:20.245773', 0, '4f61cc8b-716a-4897-b0f7-de22021b73b8', 'https://cdn.bazaarbound.com/product/3c5a38ba-4943-4a9a-b075-419e5570a6bd.png'),
	('127b10b0-b036-4491-a08b-376549faf328', '2025-04-16 12:28:35.417221', '2025-04-16 12:28:35.417221', 0, '5c3d38c2-9de2-45cc-bd07-40c0ca636b3e', 'https://cdn.bazaarbound.com/product/c3f4a6d3-21ac-4bbe-9dd8-ff13098b083f.png'),
	('15d7c9f4-88a6-4a23-ba94-859b9eb390a7', '2025-04-17 04:37:54.865663', '2025-04-17 04:37:54.865663', 0, '655769c2-e037-42db-b8f2-9277d5e337ef', 'https://cdn.bazaarbound.com/product/998d238e-613b-4f8f-91bc-8cf970d9ecd4.png'),
	('1b9ea1ce-9fc0-4933-8a64-4fcf24296b43', '2025-04-07 06:06:16.116080', '2025-04-07 06:06:16.116080', 0, '34be6de0-be19-484c-8c10-dbb4ad3ea528', 'https://cdn.bazaarbound.com/product/9aef67d5-982b-462b-b73d-09614206a4d7.png'),
	('1d1d7599-e707-40a4-bfe2-9e887b668204', '2025-04-17 04:00:33.077089', '2025-04-17 04:00:33.077089', 0, 'd8aec6d4-27e1-48d3-a34d-9edfd36b5dd6', 'https://cdn.bazaarbound.com/product/2bd39e3c-5b7b-4199-a911-b49f60bc0880.png'),
	('21cc73ba-0897-47b9-83e6-33b9d06b7c6d', '2025-04-17 04:32:51.338700', '2025-04-17 04:32:51.338700', 0, '6101dbcc-2112-499c-a71b-6c4730fab9cb', 'https://cdn.bazaarbound.com/product/3aaeb4fd-6d83-4deb-b321-87d391abb146.png'),
	('21fbcb51-6387-40e0-91f5-bdb3ee053eed', '2025-04-17 04:36:22.097520', '2025-04-17 04:36:22.097520', 0, '14280d34-d68e-4988-bfe7-aafcec21b049', 'https://cdn.bazaarbound.com/product/5013338f-ac31-4d6a-af35-e5a29be2314a.png'),
	('2629f2ff-dd3e-4b8d-a1ec-e5488d75a157', '2025-04-17 04:21:33.998968', '2025-04-17 04:21:33.998968', 0, 'fca11f48-2b7f-48e3-b295-224a7404e9f4', 'https://cdn.bazaarbound.com/product/2aa09385-90c9-4f8d-99de-744e0332acb8.png'),
	('35fc32cd-dd42-4ce9-9bae-d4528ffe8bee', '2025-04-16 12:37:18.749233', '2025-04-16 12:37:18.749233', 0, '4f61cc8b-716a-4897-b0f7-de22021b73b8', 'https://cdn.bazaarbound.com/product/999056e8-bedb-426f-94a6-e9aa7faf96c6.png'),
	('37d3089a-eb1f-4f63-bcaf-359fbe776a5a', '2025-04-07 06:13:05.362320', '2025-04-07 06:13:05.362320', 0, 'dde8a36e-03f3-42e8-b55d-addcbca6c2b1', 'https://cdn.bazaarbound.com/product/da970dd8-4337-4ed9-941a-9c3ed08195f2.png'),
	('3b020c2d-8f9f-403c-ab9d-6ea2851511d1', '2025-04-16 12:28:34.522265', '2025-04-16 12:28:34.522265', 0, '5c3d38c2-9de2-45cc-bd07-40c0ca636b3e', 'https://cdn.bazaarbound.com/product/4263a7c5-03a3-43ad-8817-847e1a64dec1.png'),
	('4795b536-cb31-45c8-9399-932ba66dfeba', '2025-04-17 04:14:06.388349', '2025-04-17 04:14:06.388349', 0, '95abf6c5-f577-4d45-843a-fb36d501dfd0', 'https://cdn.bazaarbound.com/product/f290b0bb-d43f-4eb3-90a0-3575b622db28.png'),
	('4a72dc0b-f054-45f3-9462-e9d88fa736c8', '2025-04-17 04:08:39.742100', '2025-04-17 04:08:39.742100', 0, '48b91a5c-7a39-4829-9111-d23a4a288a69', 'https://cdn.bazaarbound.com/product/f1ab1924-b1c4-417a-89c9-4b47fc9f8879.png'),
	('4a83aeaa-c36f-485a-af5c-e4861a339d27', '2025-04-07 06:06:16.940284', '2025-04-07 06:06:16.940284', 0, '34be6de0-be19-484c-8c10-dbb4ad3ea528', 'https://cdn.bazaarbound.com/product/dcda811a-2a0d-420b-b2a2-64c079dc52e3.png'),
	('5a88d2d0-c459-4ef5-9792-7d94eb2b533f', '2025-04-17 04:27:48.937790', '2025-04-17 04:27:48.937790', 0, '616fdb02-a926-44f9-aa8d-2a9fc9dfdd8f', 'https://cdn.bazaarbound.com/product/ee407dc5-43b6-4d33-b34b-c2623f225ef4.png'),
	('688b0266-739b-414f-972d-f3fafbe45489', '2025-04-17 04:39:22.029300', '2025-04-17 04:39:22.029300', 0, '357cd1cb-386b-49e7-ba10-37822a1c68fc', 'https://cdn.bazaarbound.com/product/d7f90d37-d536-40fe-937a-03c353e899ad.png'),
	('77314520-6f95-44d0-bf33-951f8a0bccab', '2025-04-17 04:25:19.444084', '2025-04-17 04:25:19.444084', 0, '151a06a0-b4bb-48b1-819c-ae4e7432ad86', 'https://cdn.bazaarbound.com/product/23b8abd6-2a28-485c-988b-6e56f9a1dfb3.png'),
	('862ebff2-2010-46d6-830c-311882ac2d12', '2025-04-17 04:36:21.429160', '2025-04-17 04:36:21.429160', 0, '14280d34-d68e-4988-bfe7-aafcec21b049', 'https://cdn.bazaarbound.com/product/2cb03ccb-d570-4a87-8ea6-78ab5f6d49fb.png'),
	('920dcf52-884d-4ce5-9abe-3e401152f62c', '2025-04-07 05:54:44.984585', '2025-04-07 05:54:44.984585', 0, 'c3ea99d1-5558-47b8-83ed-67adeb6797da', 'https://cdn.bazaarbound.com/product/0905149e-d13f-4ead-a3a5-7a2d05cb0bfd.png'),
	('a9abe45c-529d-4aff-8e51-36e9eb06e527', '2025-04-17 04:39:20.514948', '2025-04-17 04:39:20.514948', 0, '357cd1cb-386b-49e7-ba10-37822a1c68fc', 'https://cdn.bazaarbound.com/product/d964ff35-e523-4330-978f-5b6c856b4730.png'),
	('b3f52835-efb1-47b4-8eca-c460bf4f085d', '2025-04-07 05:54:45.789501', '2025-04-07 05:54:45.789501', 0, 'c3ea99d1-5558-47b8-83ed-67adeb6797da', 'https://cdn.bazaarbound.com/product/24b58c49-2b23-4efe-ad73-5299eb3ff96f.png'),
	('b45907c7-7138-4734-bcf1-edf0b8d02999', '2025-04-17 04:08:38.916815', '2025-04-17 04:08:38.916815', 0, '48b91a5c-7a39-4829-9111-d23a4a288a69', 'https://cdn.bazaarbound.com/product/2b466c72-42b3-4df5-a0c8-3bf26e7090d0.png'),
	('c3338da6-37fe-45d9-b4b4-54c60c9ab22a', '2025-04-17 04:21:32.365028', '2025-04-17 04:21:32.365028', 0, 'fca11f48-2b7f-48e3-b295-224a7404e9f4', 'https://cdn.bazaarbound.com/product/7465d063-f56d-4fb5-ae62-08c012b889fd.png'),
	('c4512acb-7501-4d1b-84f1-dea94efead77', '2025-04-17 04:14:07.943356', '2025-04-17 04:14:07.943356', 0, '95abf6c5-f577-4d45-843a-fb36d501dfd0', 'https://cdn.bazaarbound.com/product/60c20dd9-7e4b-4e67-a885-2eeb932c6c9d.png'),
	('c8c9e7dd-314e-4290-816b-b65addaa091e', '2025-04-17 04:37:53.364843', '2025-04-17 04:37:53.364843', 0, '655769c2-e037-42db-b8f2-9277d5e337ef', 'https://cdn.bazaarbound.com/product/5a072715-e6a2-4034-99cd-500a5a814f68.png'),
	('d28fdd28-1748-4cfe-993f-83e0140c8f96', '2025-04-17 04:25:17.897590', '2025-04-17 04:25:17.897590', 0, '151a06a0-b4bb-48b1-819c-ae4e7432ad86', 'https://cdn.bazaarbound.com/product/8a17954e-ea24-4128-9fd7-6b2e3f4e58a1.png'),
	('db663c26-01ab-4ac5-8f9c-74f133aab736', '2025-04-07 06:13:06.173609', '2025-04-07 06:13:06.173609', 0, 'dde8a36e-03f3-42e8-b55d-addcbca6c2b1', 'https://cdn.bazaarbound.com/product/152cda23-fc54-48b7-b4e4-08f1281d0030.png'),
	('dc95486d-98e8-49ae-94d3-495b47598460', '2025-04-17 04:32:49.791179', '2025-04-17 04:32:49.791179', 0, '6101dbcc-2112-499c-a71b-6c4730fab9cb', 'https://cdn.bazaarbound.com/product/9e7d99a5-8563-4e39-9677-26c57cf0c6e5.png'),
	('fa30139c-865a-4890-a1f7-d31f879266fc', '2025-04-17 04:27:50.407523', '2025-04-17 04:27:50.407523', 0, '616fdb02-a926-44f9-aa8d-2a9fc9dfdd8f', 'https://cdn.bazaarbound.com/product/7aa545b7-cb71-47cd-817b-d45c6dedc01d.png'),
	('fdc55784-0263-4f2f-8f04-ee377cf77eae', '2025-04-17 04:00:32.278296', '2025-04-17 04:00:32.278296', 0, 'd8aec6d4-27e1-48d3-a34d-9edfd36b5dd6', 'https://cdn.bazaarbound.com/product/66adb9cb-757c-416d-8186-961de3c6150f.png');

-- Dumping structure for table bazaarbound.product-review
CREATE TABLE IF NOT EXISTS `product-review` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `productId` varchar(255) NOT NULL,
  `rating` float NOT NULL,
  `userId` varchar(255) NOT NULL,
  `vendorId` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.product-review: ~2 rows (approximately)
INSERT INTO `product-review` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `productId`, `rating`, `userId`, `vendorId`) VALUES
	('308cb4a8-3da9-428d-833c-d623267286ae', '2025-06-01 08:42:35.143636', '2025-06-01 08:42:35.143636', 0, '14280d34-d68e-4988-bfe7-aafcec21b049', 4, '01f922cf-6704-44ed-b82e-522c00b12253', 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2'),
	('daa855cf-8605-416b-84ae-8fdd910eeaee', '2025-06-01 08:43:13.536932', '2025-06-01 08:43:13.536932', 0, '151a06a0-b4bb-48b1-819c-ae4e7432ad86', 4, '01f922cf-6704-44ed-b82e-522c00b12253', 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2');

-- Dumping structure for table bazaarbound.promotions
CREATE TABLE IF NOT EXISTS `promotions` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `image` varchar(255) NOT NULL,
  `link` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.promotions: ~2 rows (approximately)
INSERT INTO `promotions` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `image`, `link`, `status`) VALUES
	('7039db55-cb31-43bb-a81d-5e6123b80156', '2025-04-21 06:14:29.104651', '2025-04-21 06:14:29.104651', 0, 'https://cdn.bazaarbound.com/promotions/133eb46f-44f8-4718-a963-dbccf88600f3.jpeg', '/shop', 1),
	('b85d58dd-4f5d-4c6c-9f51-73b838d6c129', '2025-04-21 06:11:45.748331', '2025-04-21 06:11:45.748331', 0, 'https://cdn.bazaarbound.com/promotions/08bf4b11-218f-4029-8643-356dfe04c7af.jpeg', '/shop', 1);

-- Dumping structure for table bazaarbound.refresh-token
CREATE TABLE IF NOT EXISTS `refresh-token` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `token` longtext NOT NULL,
  `userId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `REL_980388a8baa20f67d6610a1afd` (`userId`),
  CONSTRAINT `FK_980388a8baa20f67d6610a1afd3` FOREIGN KEY (`userId`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.refresh-token: ~0 rows (approximately)

-- Dumping structure for table bazaarbound.return-policy-cms
CREATE TABLE IF NOT EXISTS `return-policy-cms` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.return-policy-cms: ~0 rows (approximately)

-- Dumping structure for table bazaarbound.roles
CREATE TABLE IF NOT EXISTS `roles` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.roles: ~0 rows (approximately)

-- Dumping structure for table bazaarbound.second-category
CREATE TABLE IF NOT EXISTS `second-category` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `bannerImage` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `mainCategoryId` varchar(255) NOT NULL,
  `mainCategoryName` varchar(255) NOT NULL,
  `firstCategoryId` varchar(255) NOT NULL,
  `firstCategoryName` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.second-category: ~2 rows (approximately)
INSERT INTO `second-category` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `name`, `slug`, `bannerImage`, `status`, `mainCategoryId`, `mainCategoryName`, `firstCategoryId`, `firstCategoryName`) VALUES
	('c92e055d-0f0b-410b-9c21-2208c538f869', '2025-03-22 09:46:08.027623', '2025-03-22 09:46:08.027623', 0, 'Quran', 'quran', 'https://cdn.bazaarbound.com/second-category/b02bb4d3-c18b-42c9-9d2b-d9f1779aaa04.jpeg', 1, 'c9727476-7894-4588-a787-1d46a9d7bbc3', 'E-Book', '0f7c027d-45bb-4d41-8f6d-4fb9024df270', 'Religious Book'),
	('e1211170-09ab-4063-a719-91cb941d2f17', '2025-03-22 11:24:13.283143', '2025-03-22 11:36:55.000000', 0, 'Hadith', 'hadith', 'https://cdn.bazaarbound.com/second-category/02ed4f86-c82b-49d1-ae93-c164c7217f01.jpeg', 1, 'c9727476-7894-4588-a787-1d46a9d7bbc3', 'E-Book', '0f7c027d-45bb-4d41-8f6d-4fb9024df270', 'Religious Book');

-- Dumping structure for table bazaarbound.shop-page-cms
CREATE TABLE IF NOT EXISTS `shop-page-cms` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `bannerImage` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.shop-page-cms: ~0 rows (approximately)
INSERT INTO `shop-page-cms` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `bannerImage`) VALUES
	('a2a962fb-6642-468e-950e-cfa423ef3e7c', '2025-05-08 10:10:57.862846', '2025-05-08 10:10:57.862846', 0, 'https://cdn.bazaarbound.com/shop-page/b5973253-1fc3-47bc-abac-1ddf5518f3be.jpeg');

-- Dumping structure for table bazaarbound.social-link
CREATE TABLE IF NOT EXISTS `social-link` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `icon` varchar(255) NOT NULL,
  `link` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.social-link: ~0 rows (approximately)

-- Dumping structure for table bazaarbound.terms-and-conditions-cms
CREATE TABLE IF NOT EXISTS `terms-and-conditions-cms` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.terms-and-conditions-cms: ~0 rows (approximately)

-- Dumping structure for table bazaarbound.third-category
CREATE TABLE IF NOT EXISTS `third-category` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `bannerImage` varchar(255) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `mainCategoryId` varchar(255) NOT NULL,
  `mainCategoryName` varchar(255) NOT NULL,
  `firstCategoryId` varchar(255) NOT NULL,
  `firstCategoryName` varchar(255) NOT NULL,
  `secondCategoryId` varchar(255) NOT NULL,
  `secondCategoryName` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.third-category: ~0 rows (approximately)
INSERT INTO `third-category` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `name`, `slug`, `bannerImage`, `status`, `mainCategoryId`, `mainCategoryName`, `firstCategoryId`, `firstCategoryName`, `secondCategoryId`, `secondCategoryName`) VALUES
	('7a46ff00-6ae5-472b-bc29-2f0082eee751', '2025-03-23 06:30:19.423291', '2025-03-23 06:30:19.423291', 0, 'Tafseer', 'tafseer', 'https://cdn.bazaarbound.com/third-category/09179979-b0b1-41f4-befd-ecb74efa0498.jpeg', 1, 'c9727476-7894-4588-a787-1d46a9d7bbc3', 'E-Book', '0f7c027d-45bb-4d41-8f6d-4fb9024df270', 'Religious Book', 'c92e055d-0f0b-410b-9c21-2208c538f869', 'Quran');

-- Dumping structure for table bazaarbound.unique-code-generator
CREATE TABLE IF NOT EXISTS `unique-code-generator` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `productCode` varchar(255) DEFAULT NULL,
  `orderId` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.unique-code-generator: ~18 rows (approximately)
INSERT INTO `unique-code-generator` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `productCode`, `orderId`) VALUES
	('0248b87b-9ccb-4720-8717-2355656beb01', '2025-05-21 09:00:19.956354', '2025-05-21 09:00:19.956354', 0, '78870154', NULL),
	('0567ee92-baab-4e0c-8df0-e8483da3499c', '2025-05-20 06:17:22.129554', '2025-05-20 06:17:22.129554', 0, NULL, 'BB672719'),
	('094ba335-fb36-4e40-840b-617b5f84a744', '2025-05-19 10:48:55.539356', '2025-05-19 10:48:55.539356', 0, NULL, 'BB686618'),
	('0f45c05f-8fdb-40a8-baa1-19480dfeecc3', '2025-05-20 06:21:00.155312', '2025-05-20 06:21:00.155312', 0, NULL, 'BB241017'),
	('0ff88f05-044b-460f-bd9d-dbdd395bcda3', '2025-05-20 06:14:18.086967', '2025-05-20 06:14:18.086967', 0, NULL, 'BB785725'),
	('296eee3d-9b1f-4ca0-aa9d-65f36c53c585', '2025-05-19 11:01:43.375090', '2025-05-19 11:01:43.375090', 0, NULL, 'BB448863'),
	('2a83f359-fd39-48ba-8ee9-a7274b89282e', '2025-05-19 11:03:57.206112', '2025-05-19 11:03:57.206112', 0, NULL, 'BB615949'),
	('3e63318a-1842-4dd7-839e-38fe5ee86715', '2025-06-02 04:56:00.779384', '2025-06-02 04:56:00.779384', 0, NULL, 'BB383078'),
	('4ad9fb5d-3299-4b78-8b7e-b6f49fd6ef49', '2025-05-19 10:52:57.956651', '2025-05-19 10:52:57.956651', 0, NULL, 'BB549734'),
	('53e3ff7a-078e-4a48-9b5e-cb1d8817e81b', '2025-06-02 04:56:45.530495', '2025-06-02 04:56:45.530495', 0, NULL, 'BB263160'),
	('5e2b2150-ecf8-4297-9f9a-88775f01a79d', '2025-05-20 06:16:42.868951', '2025-05-20 06:16:42.868951', 0, NULL, 'BB516766'),
	('79206968-e07e-4926-9145-51240117340d', '2025-05-20 06:17:00.026636', '2025-05-20 06:17:00.026636', 0, NULL, 'BB911223'),
	('7a9df416-142e-4a33-a817-e8bd3eed5928', '2025-05-19 11:02:23.505084', '2025-05-19 11:02:23.505084', 0, NULL, 'BB443722'),
	('92217126-43be-4d25-bd90-971bb73fad1d', '2025-05-20 06:15:23.728533', '2025-05-20 06:15:23.728533', 0, NULL, 'BB108285'),
	('93c18227-468e-4e2c-b32c-8727c09eab44', '2025-05-19 11:07:49.509016', '2025-05-19 11:07:49.509016', 0, NULL, 'BB008421'),
	('93ef1999-a069-4376-8cc9-5d3b4c424a3b', '2025-05-20 06:14:31.708186', '2025-05-20 06:14:31.708186', 0, NULL, 'BB579927'),
	('99c23c1d-ac67-47d8-9fc0-9038bdef6f99', '2025-05-19 11:06:29.858863', '2025-05-19 11:06:29.858863', 0, NULL, 'BB859028'),
	('bec97d44-c5d6-4f9d-a761-828ff48ca77c', '2025-06-02 04:57:29.922633', '2025-06-02 04:57:29.922633', 0, NULL, 'BB584671'),
	('c5ffd6bf-cc06-4424-ae74-4f3447c26118', '2025-05-20 06:14:58.073891', '2025-05-20 06:14:58.073891', 0, NULL, 'BB286889'),
	('de11193d-d4d5-406c-9d36-f239ca008c64', '2025-05-21 09:00:20.713961', '2025-05-21 09:00:20.713961', 0, '15448835', NULL),
	('ea37db25-18c9-4516-8c11-82601d5ac5f8', '2025-05-20 06:21:39.792898', '2025-05-20 06:21:39.792898', 0, NULL, 'BB694131'),
	('f6161832-b0e5-47cc-af25-41fcbae15a9c', '2025-05-20 06:16:24.102426', '2025-05-20 06:16:24.102426', 0, NULL, 'BB620933'),
	('f90bcfc5-bbde-44f9-9cef-a6c89dfb0b4c', '2025-05-24 11:13:02.833734', '2025-05-24 11:13:02.833734', 0, NULL, 'BB107790'),
	('f9a4f7ce-112c-4cda-bf4a-09f1fe899ca8', '2025-05-20 06:12:50.821423', '2025-05-20 06:12:50.821423', 0, NULL, 'BB499224');

-- Dumping structure for table bazaarbound.user
CREATE TABLE IF NOT EXISTS `user` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `refreshToken` varchar(255) DEFAULT NULL,
  `role` enum('customer','vendor','admin') NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.user: ~5 rows (approximately)
INSERT INTO `user` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `email`, `password`, `name`, `phone`, `refreshToken`, `role`) VALUES
	('01f922cf-6704-44ed-b82e-522c00b12253', '2025-05-22 07:31:42.434851', '2025-05-22 07:31:42.434851', 0, 'abir@qligence.com', '$2b$10$TFE0uEYVNTONpDqWX6X2ZeYk5SrTM3/wfS/RGfm.nYOHZwJ88jknu', 'Abir Hassan', '01946413146', NULL, 'customer'),
	('8f30df54-cfee-452c-a079-e26e77190060', '2025-05-22 07:32:10.869090', '2025-05-22 07:32:10.869090', 0, 'zubayer@qligence.com', '$2b$10$yX4JDdd711fOqmsNNtUO2u4DEQjDYUGQ348qMw4rhnx.xR3p/Icvm', 'Zubayer Hassan', '01946413146', NULL, 'vendor'),
	('a878dda1-bf11-406d-a49b-55a1bf7c873b', '2025-05-22 11:00:09.936585', '2025-05-22 11:00:09.936585', 0, 'john.dev@gmail.com', '$2b$10$XJY7S8JoYPDH/neD3RESDOskjk7QKAdbgQ22T/B9bsSrU8tafYRDi', 'Jhon Dev', '01946413146', NULL, 'customer'),
	('d3c8da8e-0bfe-4cfe-ad45-9db2282220c2', '2025-05-22 11:00:51.740466', '2025-05-22 11:00:51.740466', 0, 'shihan@gmail.com', '$2b$10$ZCaGqS1rob3tun6slsMBku7oIXEFPXlidNgodeyl.uJ82uAybJ/1q', 'Shihan ', '01946413146', NULL, 'vendor'),
	('fc152579-e153-4fa4-a3f8-d3d8cfb29be0', '2025-05-15 10:44:59.321924', '2025-05-15 10:44:59.321924', 0, 'sabbir@qligence.com', '$2b$10$Ntu5/BezAiu95K6F6aAAsuK/qocDFeueVgKG6ehR26GLpDYrzXIR2', 'Sabbir Hassan', '01946413146', NULL, 'admin');

-- Dumping structure for table bazaarbound.user-profile
CREATE TABLE IF NOT EXISTS `user-profile` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `profileImage` varchar(255) DEFAULT NULL,
  `shopName` varchar(255) DEFAULT NULL,
  `shopImage` varchar(255) DEFAULT NULL,
  `userId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_ddf94d1e8799f9b1a3434963021` (`userId`),
  CONSTRAINT `FK_ddf94d1e8799f9b1a3434963021` FOREIGN KEY (`userId`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.user-profile: ~5 rows (approximately)
INSERT INTO `user-profile` (`id`, `createdAt`, `updatedAt`, `isDeleted`, `profileImage`, `shopName`, `shopImage`, `userId`) VALUES
	('3af9f0c8-1e4f-4c01-ae65-4e1b2cd3d69e', '2025-05-22 11:00:09.945356', '2025-05-22 11:00:09.945356', 0, NULL, NULL, NULL, 'a878dda1-bf11-406d-a49b-55a1bf7c873b'),
	('775f88a5-d21e-4b84-8f54-f2d027045c90', '2025-05-22 07:32:10.873382', '2025-05-22 07:32:10.873382', 0, NULL, NULL, NULL, '8f30df54-cfee-452c-a079-e26e77190060'),
	('8038d539-9874-41ce-bc5c-ed888e76791a', '2025-05-15 10:44:59.332579', '2025-05-15 10:44:59.332579', 0, NULL, NULL, NULL, 'fc152579-e153-4fa4-a3f8-d3d8cfb29be0'),
	('905dc740-f782-44bf-a9f6-67d77b342e2d', '2025-05-22 07:31:42.443395', '2025-05-22 07:31:42.443395', 0, NULL, NULL, NULL, '01f922cf-6704-44ed-b82e-522c00b12253'),
	('ed199f95-7369-49e1-863e-845349292dcf', '2025-05-22 11:00:51.744642', '2025-05-22 11:00:51.744642', 0, NULL, NULL, NULL, 'd3c8da8e-0bfe-4cfe-ad45-9db2282220c2');

-- Dumping structure for table bazaarbound.vendor-message
CREATE TABLE IF NOT EXISTS `vendor-message` (
  `id` varchar(36) NOT NULL,
  `createdAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `isDeleted` tinyint NOT NULL DEFAULT '0',
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `message` longtext NOT NULL,
  `vendorId` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table bazaarbound.vendor-message: ~0 rows (approximately)

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
