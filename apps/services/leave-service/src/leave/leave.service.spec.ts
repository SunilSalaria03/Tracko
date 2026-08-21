import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { PublicUser } from '../users/user.types';
import { LeaveRepository } from './leave.repository';
import { LeaveService } from './leave.service';

const employee: PublicUser = {
  id: 'user-1',
  firstName: 'Emp',
  lastName: 'One',
  email: 'emp@tracko.local',
  role: 'EMPLOYEE',
  hasPassword: true,
  hasGoogle: false,
};

const admin: PublicUser = {
  ...employee,
  id: 'admin-1',
  role: 'ADMIN',
  email: 'admin@tracko.local',
};

function isoPlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

describe('LeaveService', () => {
  let service: LeaveService;
  let repository: {
    findUserCreatedAt: jest.Mock;
    getBalance: jest.Mock;
    upsertBalance: jest.Mock;
    sumPendingDays: jest.Mock;
    createRequest: jest.Mock;
    findRequestById: jest.Mock;
    listRequests: jest.Mock;
    reviewRequest: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      findUserCreatedAt: jest.fn().mockResolvedValue(new Date().toISOString()),
      getBalance: jest.fn().mockResolvedValue({
        userId: employee.id,
        casualBalance: 5,
        sickBalance: 2.5,
        lastAccrualMonth: '2099-12',
        updatedAt: new Date().toISOString(),
      }),
      upsertBalance: jest.fn(),
      sumPendingDays: jest.fn().mockResolvedValue(0),
      createRequest: jest.fn().mockResolvedValue({ id: 'leave-1' }),
      findRequestById: jest.fn(),
      listRequests: jest.fn(),
      reviewRequest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: LeaveRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(LeaveService);
  });

  it('rejects casual leave applied with less than 10 days notice', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'CASUAL',
        startDate: isoPlusDays(5),
        endDate: isoPlusDays(5),
        startSession: 'FULL',
        endSession: 'FULL',
        reason: 'Personal work',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows sick leave without advance notice when balance exists', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'SICK',
        startDate: isoPlusDays(0),
        endDate: isoPlusDays(0),
        startSession: 'FULL',
        endSession: 'FULL',
        reason: 'Fever',
      }),
    ).resolves.toMatchObject({ id: 'leave-1' });
  });

  it('allows first half day leave as 0.5 days', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'SICK',
        startDate: isoPlusDays(0),
        endDate: isoPlusDays(0),
        startSession: 'FIRST_HALF',
        endSession: 'FIRST_HALF',
        reason: 'Doctor visit',
      }),
    ).resolves.toMatchObject({ id: 'leave-1' });

    expect(repository.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        days: 0.5,
        startSession: 'FIRST_HALF',
        endSession: 'FIRST_HALF',
      }),
    );
  });

  it('calculates 1.5 days for full day plus next first half', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'SICK',
        startDate: isoPlusDays(0),
        endDate: isoPlusDays(1),
        startSession: 'FULL',
        endSession: 'FIRST_HALF',
        reason: 'Recovery',
      }),
    ).resolves.toMatchObject({ id: 'leave-1' });

    expect(repository.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ days: 1.5 }),
    );
  });

  it('calculates continuous second half then next first half as 1 day', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'SICK',
        startDate: isoPlusDays(0),
        endDate: isoPlusDays(1),
        startSession: 'SECOND_HALF',
        endSession: 'FIRST_HALF',
        reason: 'Half then half',
      }),
    ).resolves.toMatchObject({ id: 'leave-1' });

    expect(repository.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ days: 1 }),
    );
  });

  it('rejects multi-day leave that starts with first half (gap)', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'SICK',
        startDate: isoPlusDays(0),
        endDate: isoPlusDays(1),
        startSession: 'FIRST_HALF',
        endSession: 'FULL',
        reason: 'Gap afternoon',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects multi-day leave that ends with second half (gap)', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'SICK',
        startDate: isoPlusDays(0),
        endDate: isoPlusDays(1),
        startSession: 'FULL',
        endSession: 'SECOND_HALF',
        reason: 'Gap morning',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows unpaid leave without balance', async () => {
    await expect(
      service.apply(employee, {
        leaveType: 'UNPAID',
        startDate: isoPlusDays(1),
        endDate: isoPlusDays(2),
        startSession: 'FULL',
        endSession: 'FULL',
        reason: 'Travel',
      }),
    ).resolves.toMatchObject({ id: 'leave-1' });
  });

  it('rejects apply when sick balance is insufficient', async () => {
    repository.getBalance.mockResolvedValue({
      userId: employee.id,
      casualBalance: 5,
      sickBalance: 0.5,
      lastAccrualMonth: '2099-12',
      updatedAt: new Date().toISOString(),
    });

    await expect(
      service.apply(employee, {
        leaveType: 'SICK',
        startDate: isoPlusDays(0),
        endDate: isoPlusDays(2),
        startSession: 'FULL',
        endSession: 'FULL',
        reason: 'Long illness',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deducts casual balance on admin approve', async () => {
    repository.findRequestById.mockResolvedValue({
      id: 'leave-1',
      userId: employee.id,
      leaveType: 'CASUAL',
      days: 1,
      requestedDays: 1,
      status: 'PENDING',
    });
    repository.reviewRequest.mockResolvedValue({
      id: 'leave-1',
      status: 'APPROVED',
    });

    await service.review(admin, 'leave-1', { status: 'APPROVED' });

    expect(repository.upsertBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: employee.id,
        casualBalance: 4,
      }),
    );
  });

  it('requires rejection reason', async () => {
    repository.findRequestById.mockResolvedValue({
      id: 'leave-1',
      userId: employee.id,
      leaveType: 'CASUAL',
      days: 1,
      requestedDays: 1,
      status: 'PENDING',
    });

    await expect(
      service.review(admin, 'leave-1', { status: 'REJECTED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires reason when admin reduces approved days', async () => {
    repository.findRequestById.mockResolvedValue({
      id: 'leave-1',
      userId: employee.id,
      leaveType: 'CASUAL',
      days: 3,
      requestedDays: 3,
      status: 'PENDING',
    });

    await expect(
      service.review(admin, 'leave-1', {
        status: 'APPROVED',
        approvedDays: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deducts edited days on approve', async () => {
    repository.findRequestById.mockResolvedValue({
      id: 'leave-1',
      userId: employee.id,
      leaveType: 'CASUAL',
      days: 3,
      requestedDays: 3,
      status: 'PENDING',
    });
    repository.reviewRequest.mockResolvedValue({
      id: 'leave-1',
      status: 'APPROVED',
    });

    await service.review(admin, 'leave-1', {
      status: 'APPROVED',
      approvedDays: 2,
      daysEditReason: 'Only 2 days needed',
    });

    expect(repository.upsertBalance).toHaveBeenCalledWith(
      expect.objectContaining({ casualBalance: 3 }),
    );
    expect(repository.reviewRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        days: 2,
        daysEditReason: 'Only 2 days needed',
      }),
    );
  });

  it('lets employee delete upcoming pending leave', async () => {
    repository.findRequestById.mockResolvedValue({
      id: 'leave-1',
      userId: employee.id,
      leaveType: 'CASUAL',
      days: 1,
      requestedDays: 1,
      status: 'PENDING',
      startDate: isoPlusDays(12),
    });
    repository.deleteRequest = jest.fn().mockResolvedValue(true);

    await expect(
      service.deleteMyRequest(employee, 'leave-1'),
    ).resolves.toEqual({ ok: true });
    expect(repository.deleteRequest).toHaveBeenCalledWith(
      'leave-1',
      employee.id,
    );
    expect(repository.upsertBalance).not.toHaveBeenCalled();
  });

  it('restores balance when employee deletes upcoming approved leave', async () => {
    repository.findRequestById.mockResolvedValue({
      id: 'leave-1',
      userId: employee.id,
      leaveType: 'CASUAL',
      days: 2,
      requestedDays: 2,
      status: 'APPROVED',
      startDate: isoPlusDays(12),
    });
    repository.deleteRequest = jest.fn().mockResolvedValue(true);

    await expect(
      service.deleteMyRequest(employee, 'leave-1'),
    ).resolves.toEqual({ ok: true });
    expect(repository.upsertBalance).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: employee.id,
        casualBalance: 7,
      }),
    );
  });

  it('rejects delete of past leave', async () => {
    repository.findRequestById.mockResolvedValue({
      id: 'leave-1',
      userId: employee.id,
      leaveType: 'CASUAL',
      days: 1,
      status: 'PENDING',
      startDate: isoPlusDays(-1),
    });

    await expect(
      service.deleteMyRequest(employee, 'leave-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
