import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MastersRepository } from './masters.repository';
import { MastersService } from './masters.service';

describe('MastersService', () => {
  let service: MastersService;
  let repository: {
    listProjects: jest.Mock;
    findProject: jest.Mock;
    createProject: jest.Mock;
    updateProject: jest.Mock;
    deleteProject: jest.Mock;
    listTasks: jest.Mock;
    createTask: jest.Mock;
    updateTask: jest.Mock;
    deleteTask: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      listProjects: jest.fn(),
      findProject: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      deleteProject: jest.fn(),
      listTasks: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MastersService,
        { provide: MastersRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(MastersService);
  });

  it('creates a task under a project', async () => {
    repository.findProject.mockResolvedValue({
      id: 'project-1',
      name: 'Internal',
      color: '#188433',
      isActive: true,
    });
    repository.createTask.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-1',
      projectName: 'Internal',
      name: 'Development',
      isActive: true,
    });

    await expect(
      service.createTask({
        projectId: 'project-1',
        name: 'Development',
      }),
    ).resolves.toMatchObject({ name: 'Development', projectName: 'Internal' });
  });

  it('rejects a task when the project is missing', async () => {
    repository.findProject.mockResolvedValue(null);

    await expect(
      service.createTask({
        projectId: 'missing',
        name: 'Development',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate project name', async () => {
    repository.createProject.mockRejectedValue({ code: '23505' });

    await expect(
      service.createProject({ name: 'Internal' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes a project', async () => {
    repository.deleteProject.mockResolvedValue(true);

    await expect(service.deleteProject('project-1')).resolves.toEqual({
      ok: true,
    });
  });

  it('rejects deleting a missing project', async () => {
    repository.deleteProject.mockResolvedValue(false);

    await expect(service.deleteProject('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes a task', async () => {
    repository.deleteTask.mockResolvedValue(true);

    await expect(service.deleteTask('task-1')).resolves.toEqual({ ok: true });
  });

  it('rejects deleting a missing task', async () => {
    repository.deleteTask.mockResolvedValue(false);

    await expect(service.deleteTask('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
