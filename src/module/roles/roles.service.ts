import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeleteInterface, RoleInterface } from '../../common/types';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from './entities/role.entity';
import { RolesRepository } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}
  async create(createRoleDto: CreateRoleDto): Promise<RoleInterface> {
    try {
      const { name } = createRoleDto;
      const role = await this.rolesRepository.findOneByQuery({ name });
      if (role) {
        throw new HttpException('Role Already Exists', HttpStatus.BAD_REQUEST);
      }
      const newRole = (await this.rolesRepository.create(createRoleDto)) as Roles | null;
      if (!newRole) {
        throw new HttpException(
          'Something went wrong! Please try again.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      return newRole;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async findAll(): Promise<Roles[]> {
    try {
      return await this.rolesRepository.findAll({});
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async findOne(id: string): Promise<Roles | null> {
    try {
      return await this.rolesRepository.findOne(id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  async update(id: string, data: UpdateRoleDto): Promise<Roles | null> {
    try {
      const role = await this.rolesRepository.findOne(id);
      if (!role) {
        throw new HttpException('Role Does not Exists', HttpStatus.BAD_REQUEST);
      }
      const updateRole = await this.rolesRepository.update(id, data);
      if (!updateRole) {
        throw new HttpException(
          'Something went wrong! Please try again.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      return updateRole;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async remove(id: string): Promise<DeleteInterface> {
    try {
      const role = await this.rolesRepository.findOne(id);
      if (!role) {
        throw new HttpException('Role Not Found', HttpStatus.BAD_REQUEST);
      }
      const res = await this.rolesRepository.delete(id);
      const result = res.affected === 1 ? { deleted: true } : { deleted: false };
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      throw new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
