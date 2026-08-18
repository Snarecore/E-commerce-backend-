import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DeleteInterface, RoleInterface } from 'src/common/types';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from './entities/role.entity';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  async create(@Body() createRoleDto: CreateRoleDto): Promise<RoleInterface> {
    return await this.rolesService.create(createRoleDto);
  }

  @Get()
  async findAll(): Promise<Roles[]> {
    return await this.rolesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Roles | null> {
    return await this.rolesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto): Promise<Roles | null> {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<DeleteInterface> {
    return await this.rolesService.remove(id);
  }
}
