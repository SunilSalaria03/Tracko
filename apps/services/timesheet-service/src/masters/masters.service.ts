import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../auth/auth.constants';
import { UpsertProjectDto } from './dto/upsert-project.dto';
import { UpsertTaskDto } from './dto/upsert-task.dto';
import { MastersRepository } from './masters.repository';
import type { Project, Task } from './masters.types';

@Injectable()
export class MastersService {
  constructor(private readonly mastersRepository: MastersRepository) {}

  listProjects(): Promise<Project[]> {
    return this.mastersRepository.listProjects();
  }

  listTasks(projectId?: string): Promise<Task[]> {
    return this.mastersRepository.listTasks(projectId);
  }

  async createProject(dto: UpsertProjectDto): Promise<Project> {
    try {
      return await this.mastersRepository.createProject({
        name: dto.name,
        color: dto.color ?? '#188433',
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A project with this name already exists');
      }

      throw error;
    }
  }

  async updateProject(id: string, dto: UpsertProjectDto): Promise<Project> {
    const updated = await this.mastersRepository.updateProject(id, {
      name: dto.name,
      color: dto.color ?? '#188433',
      isActive: dto.isActive ?? true,
    });

    if (!updated) {
      throw new NotFoundException('Project not found');
    }

    return updated;
  }

  async deleteProject(id: string): Promise<{ ok: true }> {
    const deleted = await this.mastersRepository.deleteProject(id);

    if (!deleted) {
      throw new NotFoundException('Project not found');
    }

    return { ok: true };
  }

  async createTask(dto: UpsertTaskDto): Promise<Task> {
    const project = await this.mastersRepository.findProject(dto.projectId);

    if (!project) {
      throw new NotFoundException('Select a valid project');
    }

    try {
      return await this.mastersRepository.createTask({
        projectId: dto.projectId,
        name: dto.name,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This task already exists on the project');
      }

      throw error;
    }
  }

  async updateTask(id: string, dto: UpsertTaskDto): Promise<Task> {
    const project = await this.mastersRepository.findProject(dto.projectId);

    if (!project) {
      throw new NotFoundException('Select a valid project');
    }

    try {
      const updated = await this.mastersRepository.updateTask(id, {
        projectId: dto.projectId,
        name: dto.name,
        isActive: dto.isActive ?? true,
      });

      if (!updated) {
        throw new NotFoundException('Task not found');
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This task already exists on the project');
      }

      throw error;
    }
  }

  async deleteTask(id: string): Promise<{ ok: true }> {
    const deleted = await this.mastersRepository.deleteTask(id);

    if (!deleted) {
      throw new NotFoundException('Task not found');
    }

    return { ok: true };
  }
}
