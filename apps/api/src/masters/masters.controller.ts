import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpsertProjectDto } from './dto/upsert-project.dto';
import { UpsertTaskDto } from './dto/upsert-task.dto';
import { MastersService } from './masters.service';
import type { Project, Task } from './masters.types';

@Controller()
@UseGuards(JwtAuthGuard)
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  @Get('projects')
  listProjects(): Promise<Project[]> {
    return this.mastersService.listProjects();
  }

  @Post('projects')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createProject(@Body() dto: UpsertProjectDto): Promise<Project> {
    return this.mastersService.createProject(dto);
  }

  @Patch('projects/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertProjectDto,
  ): Promise<Project> {
    return this.mastersService.updateProject(id, dto);
  }

  @Delete('projects/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteProject(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.mastersService.deleteProject(id);
  }

  @Get('tasks')
  listTasks(@Query('projectId') projectId?: string): Promise<Task[]> {
    return this.mastersService.listTasks(projectId);
  }

  @Post('tasks')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  createTask(@Body() dto: UpsertTaskDto): Promise<Task> {
    return this.mastersService.createTask(dto);
  }

  @Patch('tasks/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertTaskDto,
  ): Promise<Task> {
    return this.mastersService.updateTask(id, dto);
  }

  @Delete('tasks/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deleteTask(@Param('id', ParseUUIDPipe) id: string): Promise<{ ok: true }> {
    return this.mastersService.deleteTask(id);
  }
}
