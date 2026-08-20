import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TimesheetsRepository } from './timesheets.repository';
import { TimesheetsService } from './timesheets.service';
import type { PublicUser } from '../users/user.types';

const user: PublicUser = {
  id: 'user-1',
  firstName: 'Tracko',
  lastName: 'Admin',
  email: 'admin@tracko.local',
  role: 'ADMIN',
  hasPassword: true,
  hasGoogle: false,
};

describe('TimesheetsService', () => {
  let service: TimesheetsService;
  let repository: {
    listProjectTasks: jest.Mock;
    findProjectTask: jest.Mock;
    listEntries: jest.Mock;
    findEntryById: jest.Mock;
    sumHoursForDate: jest.Mock;
    createEntry: jest.Mock;
    updateEntry: jest.Mock;
    deleteEntry: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      listProjectTasks: jest.fn(),
      findProjectTask: jest.fn(),
      listEntries: jest.fn(),
      findEntryById: jest.fn(),
      sumHoursForDate: jest.fn(),
      createEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimesheetsService,
        { provide: TimesheetsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(TimesheetsService);
  });

  it('rejects a create for a future date', async () => {
    await expect(
      service.createEntry(user, {
        projectId: 'p1',
        taskId: 't1',
        entryDate: '2099-12-31',
        hours: 2,
        description: 'Planning',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a create when the day would exceed 24 hours', async () => {
    repository.findProjectTask.mockResolvedValue({
      project: { id: 'p1', name: 'Internal', color: '#188433', isActive: true },
      task: {
        id: 't1',
        projectId: 'p1',
        projectName: 'Internal',
        name: 'Development',
        isActive: true,
      },
    });
    repository.sumHoursForDate.mockResolvedValue(20);

    await expect(
      service.createEntry(user, {
        projectId: 'p1',
        taskId: 't1',
        entryDate: todayIso(),
        hours: 5,
        description: 'Development work',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an entry when the day stays within 24 hours', async () => {
    repository.findProjectTask.mockResolvedValue({
      project: { id: 'p1', name: 'Internal', color: '#188433', isActive: true },
      task: {
        id: 't1',
        projectId: 'p1',
        projectName: 'Internal',
        name: 'Development',
        isActive: true,
      },
    });
    repository.sumHoursForDate.mockResolvedValue(16);
    repository.createEntry.mockResolvedValue({
      id: 'e1',
      hours: 8,
      entryDate: todayIso(),
    });

    await expect(
      service.createEntry(user, {
        projectId: 'p1',
        taskId: 't1',
        entryDate: todayIso(),
        hours: 8,
        description: 'Development work',
      }),
    ).resolves.toMatchObject({ id: 'e1' });
  });

  it('rejects moving an entry onto a day that is already full', async () => {
    repository.findEntryById.mockResolvedValue({
      id: 'e1',
      userId: 'user-1',
      projectId: 'p1',
      taskId: 't1',
      entryDate: todayIso(),
      hours: 8,
      description: 'Existing notes',
    });
    repository.findProjectTask.mockResolvedValue({
      project: { id: 'p1', name: 'Internal', color: '#188433', isActive: true },
      task: {
        id: 't1',
        projectId: 'p1',
        projectName: 'Internal',
        name: 'Development',
        isActive: true,
      },
    });
    repository.sumHoursForDate.mockResolvedValue(24);

    await expect(
      service.updateEntry(user, 'e1', { entryDate: todayIso() }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function todayIso(): string {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}
