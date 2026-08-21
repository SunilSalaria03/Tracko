export type TimesheetEntry = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  taskId: string;
  taskName: string;
  entryDate: string;
  hours: number;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TimesheetEntriesPage = {
  items: TimesheetEntry[];
  total: number;
  totalHours: number;
  page: number;
  pageSize: number;
};
