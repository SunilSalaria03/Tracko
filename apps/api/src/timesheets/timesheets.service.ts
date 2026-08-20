import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicUser } from '../users/user.types';
import { CreateTimesheetEntryDto } from './dto/create-timesheet-entry.dto';
import { ListTimesheetEntriesDto } from './dto/list-timesheet-entries.dto';
import { UpdateTimesheetEntryDto } from './dto/update-timesheet-entry.dto';
import { TimesheetsRepository } from './timesheets.repository';
import type { TimesheetEntry } from './timesheets.types';

const MAX_DAILY_HOURS = 24;

function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

type TimesheetOptions = {
  projects: Array<{
    id: string;
    name: string;
    color: string;
    tasks: Array<{
      id: string;
      name: string;
    }>;
  }>;
};

@Injectable()
export class TimesheetsService {
  constructor(private readonly timesheetsRepository: TimesheetsRepository) {}

  async getOptions(): Promise<TimesheetOptions> {
    const rows = await this.timesheetsRepository.listProjectTasks();
    const projects = new Map<string, TimesheetOptions['projects'][number]>();

    for (const row of rows) {
      const existing =
        projects.get(row.project.id) ??
        {
          id: row.project.id,
          name: row.project.name,
          color: row.project.color,
          tasks: [],
        };

      existing.tasks.push({
        id: row.task.id,
        name: row.task.name,
      });

      projects.set(row.project.id, existing);
    }

    return { projects: Array.from(projects.values()) };
  }

  listEntries(user: PublicUser, query: ListTimesheetEntriesDto): Promise<TimesheetEntry[]> {
    return this.timesheetsRepository.listEntries(user.id, query.from, query.to);
  }

  async createEntry(
    user: PublicUser,
    dto: CreateTimesheetEntryDto,
  ): Promise<TimesheetEntry> {
    this.ensureNotFutureDate(dto.entryDate);
    await this.ensureValidProjectTask(dto.projectId, dto.taskId);
    await this.ensureDailyHoursLimit(user.id, dto.entryDate, dto.hours);

    return this.timesheetsRepository.createEntry({
      userId: user.id,
      projectId: dto.projectId,
      taskId: dto.taskId,
      entryDate: dto.entryDate,
      hours: dto.hours,
      description: dto.description.trim(),
    });
  }

  async updateEntry(
    user: PublicUser,
    id: string,
    dto: UpdateTimesheetEntryDto,
  ): Promise<TimesheetEntry> {
    const existing = await this.timesheetsRepository.findEntryById(id);
    if (!existing) {
      throw new NotFoundException('Timesheet entry not found');
    }
    if (existing.userId !== user.id) {
      throw new ForbiddenException('You can only update your own timesheet entries');
    }

    const projectId = dto.projectId ?? existing.projectId;
    const taskId = dto.taskId ?? existing.taskId;
    const projectTaskChanged =
      projectId !== existing.projectId || taskId !== existing.taskId;

    await this.ensureValidProjectTask(projectId, taskId, {
      allowInactive: !projectTaskChanged,
    });

    const entryDate = dto.entryDate ?? existing.entryDate;
    this.ensureNotFutureDate(entryDate);
    await this.ensureDailyHoursLimit(
      user.id,
      entryDate,
      existing.hours,
      existing.id,
    );

    const updated = await this.timesheetsRepository.updateEntry(id, {
      projectId,
      taskId,
      entryDate: dto.entryDate ?? existing.entryDate,
      // Hours are immutable after create.
      hours: existing.hours,
      description:
        dto.description !== undefined
          ? dto.description.trim()
          : existing.description,
    });

    if (!updated) {
      throw new NotFoundException('Timesheet entry not found');
    }

    return updated;
  }

  async getEntry(user: PublicUser, id: string): Promise<TimesheetEntry> {
    const existing = await this.timesheetsRepository.findEntryById(id);
    if (!existing) {
      throw new NotFoundException('Timesheet entry not found');
    }
    if (existing.userId !== user.id) {
      throw new ForbiddenException('You can only view your own timesheet entries');
    }
    return existing;
  }

  async deleteEntry(user: PublicUser, id: string): Promise<{ ok: true }> {
    const existing = await this.timesheetsRepository.findEntryById(id);
    if (!existing) {
      throw new NotFoundException('Timesheet entry not found');
    }
    if (existing.userId !== user.id) {
      throw new ForbiddenException('You can only delete your own timesheet entries');
    }

    await this.timesheetsRepository.deleteEntry(id);
    return { ok: true };
  }

  private ensureNotFutureDate(entryDate: string): void {
    const today = new Date();
    const todayIso = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    if (entryDate > todayIso) {
      throw new BadRequestException('You cannot fill timesheet entries for future dates');
    }
  }

  private async ensureDailyHoursLimit(
    userId: string,
    entryDate: string,
    hoursToAdd: number,
    excludeEntryId?: string,
  ): Promise<void> {
    const existingHours = await this.timesheetsRepository.sumHoursForDate(
      userId,
      entryDate,
      excludeEntryId,
    );
    const total = roundHours(existingHours + hoursToAdd);

    if (total > MAX_DAILY_HOURS) {
      const remaining = Math.max(0, roundHours(MAX_DAILY_HOURS - existingHours));
      throw new BadRequestException(
        remaining === 0
          ? `This day already has ${MAX_DAILY_HOURS} hours. You cannot add more time.`
          : `Total time for this day cannot exceed ${MAX_DAILY_HOURS} hours. Only ${remaining} hour(s) remaining.`,
      );
    }
  }

  private async ensureValidProjectTask(
    projectId: string,
    taskId: string,
    options?: { allowInactive?: boolean },
  ): Promise<void> {
    const pair = await this.timesheetsRepository.findProjectTask(projectId, taskId);

    if (!pair) {
      throw new NotFoundException('Select a valid project and task');
    }

    if (
      !options?.allowInactive &&
      (!pair.project.isActive || !pair.task.isActive)
    ) {
      throw new NotFoundException('Select an active project and task');
    }
  }
}
