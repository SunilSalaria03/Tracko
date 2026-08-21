import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Project, Task } from '../masters/masters.types';
import type { TimesheetEntry } from './timesheets.types';

type ProjectTaskRow = {
  project_id: string;
  project_name: string;
  project_color: string;
  project_is_active: boolean;
  task_id: string;
  task_name: string;
  task_is_active: boolean;
};

type TimesheetEntryRow = {
  id: string;
  user_id: string;
  project_id: string;
  project_name: string;
  project_color: string;
  task_id: string;
  task_name: string;
  entry_date: string;
  hours: string;
  description: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class TimesheetsRepository {
  constructor(private readonly database: DatabaseService) {}

  async listProjectTasks(): Promise<Array<{ project: Project; task: Task }>> {
    const result = await this.database.query<ProjectTaskRow>(
      `
        SELECT
          p.id AS project_id,
          p.name AS project_name,
          p.color AS project_color,
          p.is_active AS project_is_active,
          t.id AS task_id,
          t.name AS task_name,
          t.is_active AS task_is_active
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.is_active = TRUE AND t.is_active = TRUE
        ORDER BY p.name, t.name
      `,
    );

    return result.rows.map((row) => ({
      project: {
        id: row.project_id,
        name: row.project_name,
        color: row.project_color,
        isActive: row.project_is_active,
      },
      task: {
        id: row.task_id,
        projectId: row.project_id,
        projectName: row.project_name,
        name: row.task_name,
        isActive: row.task_is_active,
      },
    }));
  }

  async findProjectTask(projectId: string, taskId: string): Promise<{
    project: Project;
    task: Task;
  } | null> {
    const result = await this.database.query<ProjectTaskRow>(
      `
        SELECT
          p.id AS project_id,
          p.name AS project_name,
          p.color AS project_color,
          p.is_active AS project_is_active,
          t.id AS task_id,
          t.name AS task_name,
          t.is_active AS task_is_active
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE p.id = $1 AND t.id = $2
      `,
      [projectId, taskId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      project: {
        id: row.project_id,
        name: row.project_name,
        color: row.project_color,
        isActive: row.project_is_active,
      },
      task: {
        id: row.task_id,
        projectId: row.project_id,
        projectName: row.project_name,
        name: row.task_name,
        isActive: row.task_is_active,
      },
    };
  }

  async listEntries(
    userId: string,
    options: {
      from?: string;
      to?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{
    items: TimesheetEntry[];
    total: number;
    totalHours: number;
    page: number;
    pageSize: number;
  }> {
    const search = options.search?.trim() || null;
    const page = options.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options.pageSize && options.pageSize > 0 ? options.pageSize : null;
    const offset = pageSize ? (page - 1) * pageSize : 0;

    const filters = `
      WHERE te.user_id = $1
        AND ($2::date IS NULL OR te.entry_date >= $2::date)
        AND ($3::date IS NULL OR te.entry_date <= $3::date)
        AND (
          $4::text IS NULL
          OR p.name ILIKE '%' || $4 || '%'
          OR t.name ILIKE '%' || $4 || '%'
          OR te.description ILIKE '%' || $4 || '%'
          OR TO_CHAR(te.entry_date, 'YYYY-MM-DD') ILIKE '%' || $4 || '%'
          OR te.hours::text ILIKE '%' || $4 || '%'
        )
    `;

    const countResult = await this.database.query<{
      total: string;
      total_hours: string;
    }>(
      `
        SELECT
          COUNT(*)::text AS total,
          COALESCE(SUM(te.hours), 0)::text AS total_hours
        FROM timesheet_entries te
        JOIN projects p ON p.id = te.project_id
        JOIN tasks t ON t.id = te.task_id
        ${filters}
      `,
      [userId, options.from ?? null, options.to ?? null, search],
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    const totalHours = Number(countResult.rows[0]?.total_hours ?? 0);

    const listParams: unknown[] = [
      userId,
      options.from ?? null,
      options.to ?? null,
      search,
    ];
    let limitSql = '';
    if (pageSize) {
      listParams.push(pageSize, offset);
      limitSql = `LIMIT $5 OFFSET $6`;
    }

    const result = await this.database.query<TimesheetEntryRow>(
      `
        SELECT
          te.id,
          te.user_id,
          te.project_id,
          p.name AS project_name,
          p.color AS project_color,
          te.task_id,
          t.name AS task_name,
          TO_CHAR(te.entry_date, 'YYYY-MM-DD') AS entry_date,
          te.hours::text AS hours,
          te.description,
          te.created_at::text,
          te.updated_at::text
        FROM timesheet_entries te
        JOIN projects p ON p.id = te.project_id
        JOIN tasks t ON t.id = te.task_id
        ${filters}
        ORDER BY te.entry_date DESC, te.created_at DESC
        ${limitSql}
      `,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.toEntry(row)),
      total,
      totalHours,
      page,
      pageSize: pageSize ?? total,
    };
  }

  async findEntryById(id: string): Promise<TimesheetEntry | null> {
    const result = await this.database.query<TimesheetEntryRow>(
      `
        SELECT
          te.id,
          te.user_id,
          te.project_id,
          p.name AS project_name,
          p.color AS project_color,
          te.task_id,
          t.name AS task_name,
          TO_CHAR(te.entry_date, 'YYYY-MM-DD') AS entry_date,
          te.hours::text AS hours,
          te.description,
          te.created_at::text,
          te.updated_at::text
        FROM timesheet_entries te
        JOIN projects p ON p.id = te.project_id
        JOIN tasks t ON t.id = te.task_id
        WHERE te.id = $1
      `,
      [id],
    );

    return result.rows[0] ? this.toEntry(result.rows[0]) : null;
  }

  async sumHoursForDate(
    userId: string,
    entryDate: string,
    excludeEntryId?: string,
  ): Promise<number> {
    const result = await this.database.query<{ total: string }>(
      `
        SELECT COALESCE(SUM(hours), 0)::text AS total
        FROM timesheet_entries
        WHERE user_id = $1
          AND entry_date = $2::date
          AND ($3::uuid IS NULL OR id <> $3::uuid)
      `,
      [userId, entryDate, excludeEntryId ?? null],
    );

    return Number(result.rows[0]?.total ?? 0);
  }

  async createEntry(input: {
    userId: string;
    projectId: string;
    taskId: string;
    entryDate: string;
    hours: number;
    description: string;
  }): Promise<TimesheetEntry> {
    const result = await this.database.query<TimesheetEntryRow>(
      `
        INSERT INTO timesheet_entries (
          user_id,
          project_id,
          task_id,
          entry_date,
          hours,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          user_id,
          project_id,
          (SELECT name FROM projects WHERE id = $2) AS project_name,
          (SELECT color FROM projects WHERE id = $2) AS project_color,
          task_id,
          (SELECT name FROM tasks WHERE id = $3) AS task_name,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          hours::text,
          description,
          created_at::text,
          updated_at::text
      `,
      [
        input.userId,
        input.projectId,
        input.taskId,
        input.entryDate,
        input.hours,
        input.description,
      ],
    );

    return this.toEntry(result.rows[0]);
  }

  async updateEntry(
    id: string,
    input: {
      projectId: string;
      taskId: string;
      entryDate: string;
      hours: number;
      description: string;
    },
  ): Promise<TimesheetEntry | null> {
    const result = await this.database.query<TimesheetEntryRow>(
      `
        UPDATE timesheet_entries
        SET
          project_id = $2,
          task_id = $3,
          entry_date = $4,
          hours = $5,
          description = $6,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          user_id,
          project_id,
          (SELECT name FROM projects WHERE id = $2) AS project_name,
          (SELECT color FROM projects WHERE id = $2) AS project_color,
          task_id,
          (SELECT name FROM tasks WHERE id = $3) AS task_name,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          hours::text,
          description,
          created_at::text,
          updated_at::text
      `,
      [
        id,
        input.projectId,
        input.taskId,
        input.entryDate,
        input.hours,
        input.description,
      ],
    );

    return result.rows[0] ? this.toEntry(result.rows[0]) : null;
  }

  async deleteEntry(id: string): Promise<boolean> {
    const result = await this.database.query(
      `
        DELETE FROM timesheet_entries
        WHERE id = $1
        RETURNING id
      `,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  private toEntry(row: TimesheetEntryRow): TimesheetEntry {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      projectName: row.project_name,
      projectColor: row.project_color,
      taskId: row.task_id,
      taskName: row.task_name,
      entryDate: row.entry_date,
      hours: Number(row.hours),
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
