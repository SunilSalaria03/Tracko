import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Project, Task } from './masters.types';

type ProjectRow = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
};

type TaskRow = {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  is_active: boolean;
};

@Injectable()
export class MastersRepository {
  constructor(private readonly database: DatabaseService) {}

  async listProjects(): Promise<Project[]> {
    const result = await this.database.query<ProjectRow>(
      `
        SELECT id, name, color, is_active
        FROM projects
        ORDER BY name
      `,
    );

    return result.rows.map((row) => this.toProject(row));
  }

  async findProject(id: string): Promise<Project | null> {
    const result = await this.database.query<ProjectRow>(
      `
        SELECT id, name, color, is_active
        FROM projects
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ? this.toProject(result.rows[0]) : null;
  }

  async createProject(input: {
    name: string;
    color: string;
  }): Promise<Project> {
    const result = await this.database.query<ProjectRow>(
      `
        INSERT INTO projects (name, color)
        VALUES ($1, $2)
        RETURNING id, name, color, is_active
      `,
      [input.name, input.color],
    );

    return this.toProject(result.rows[0]);
  }

  async updateProject(
    id: string,
    input: { name: string; color: string; isActive: boolean },
  ): Promise<Project | null> {
    const result = await this.database.query<ProjectRow>(
      `
        UPDATE projects
        SET name = $2, color = $3, is_active = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, color, is_active
      `,
      [id, input.name, input.color, input.isActive],
    );

    return result.rows[0] ? this.toProject(result.rows[0]) : null;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await this.database.query(
      `
        DELETE FROM projects
        WHERE id = $1
        RETURNING id
      `,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async listTasks(projectId?: string): Promise<Task[]> {
    const result = await this.database.query<TaskRow>(
      `
        SELECT t.id, t.project_id, p.name AS project_name, t.name, t.is_active
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE ($1::uuid IS NULL OR t.project_id = $1)
        ORDER BY p.name, t.name
      `,
      [projectId ?? null],
    );

    return result.rows.map((row) => this.toTask(row));
  }

  async createTask(input: {
    projectId: string;
    name: string;
  }): Promise<Task> {
    const result = await this.database.query<TaskRow>(
      `
        INSERT INTO tasks (project_id, name)
        VALUES ($1, $2)
        RETURNING
          id,
          project_id,
          (SELECT name FROM projects WHERE id = $1) AS project_name,
          name,
          is_active
      `,
      [input.projectId, input.name],
    );

    return this.toTask(result.rows[0]);
  }

  async updateTask(
    id: string,
    input: { projectId: string; name: string; isActive: boolean },
  ): Promise<Task | null> {
    const result = await this.database.query<TaskRow>(
      `
        UPDATE tasks
        SET project_id = $2, name = $3, is_active = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          project_id,
          (SELECT name FROM projects WHERE id = $2) AS project_name,
          name,
          is_active
      `,
      [id, input.projectId, input.name, input.isActive],
    );

    return result.rows[0] ? this.toTask(result.rows[0]) : null;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await this.database.query(
      `
        DELETE FROM tasks
        WHERE id = $1
        RETURNING id
      `,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  private toProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      isActive: row.is_active,
    };
  }

  private toTask(row: TaskRow): Task {
    return {
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      name: row.name,
      isActive: row.is_active,
    };
  }
}
