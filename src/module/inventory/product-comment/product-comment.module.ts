import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductComment } from "./entities/product-comment.entity";
import { Product } from "../product/entities/product.entity";
import { User } from "src/module/user/entities/user.entity";
import { ProductCommentRepository } from "./product-comment.repository";
import { ProductCommentService } from "./product-comment.service";
import { ProductCommentController } from "./product-comment.controller";
import { ProductRepository } from "../product/product.repository";
import { UserRepository } from "src/module/user/user.repository";
import { UserProfileRepository } from "src/module/user-profile/user-profile.repository";

@Module({
    imports: [
        TypeOrmModule.forFeature([ProductComment, Product, User])
    ],
    controllers: [ProductCommentController],
    providers: [ProductCommentRepository, ProductCommentService, ProductRepository, UserRepository, UserProfileRepository],
    exports: [ProductCommentRepository, ProductCommentService]
})

export class ProductCommentModule {}