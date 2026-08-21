export type Project = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
};

export type Task = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  isActive: boolean;
};
