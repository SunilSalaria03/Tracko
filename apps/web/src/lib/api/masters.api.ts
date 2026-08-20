import { apiFetch, parseJson } from "@/lib/api/client";

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

export const projectsQueryKey = ["projects"] as const;
export const tasksQueryKey = (projectId?: string) =>
  ["tasks", projectId ?? "all"] as const;

export async function listProjects(): Promise<Project[]> {
  const response = await apiFetch("/api/projects");
  return parseJson<Project[]>(response);
}

export async function createProject(input: {
  name: string;
  color?: string;
}): Promise<Project> {
  const response = await apiFetch("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJson<Project>(response);
}

export async function updateProject(
  id: string,
  input: { name: string; color?: string; isActive?: boolean },
): Promise<Project> {
  const response = await apiFetch(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseJson<Project>(response);
}

export async function deleteProject(id: string): Promise<{ ok: true }> {
  const response = await apiFetch(`/api/projects/${id}`, {
    method: "DELETE",
  });
  return parseJson<{ ok: true }>(response);
}

export async function listTasks(projectId?: string): Promise<Task[]> {
  const params = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const response = await apiFetch(`/api/tasks${params}`);
  return parseJson<Task[]>(response);
}

export async function createTask(input: {
  projectId: string;
  name: string;
}): Promise<Task> {
  const response = await apiFetch("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseJson<Task>(response);
}

export async function updateTask(
  id: string,
  input: { projectId: string; name: string; isActive?: boolean },
): Promise<Task> {
  const response = await apiFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return parseJson<Task>(response);
}

export async function deleteTask(id: string): Promise<{ ok: true }> {
  const response = await apiFetch(`/api/tasks/${id}`, {
    method: "DELETE",
  });
  return parseJson<{ ok: true }>(response);
}
