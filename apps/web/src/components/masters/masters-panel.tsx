"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProject,
  createTask,
  deleteProject,
  deleteTask,
  listProjects,
  listTasks,
  updateProject,
  updateTask,
  type Project,
  type Task,
  projectsQueryKey,
  tasksQueryKey,
} from "@/lib/api/masters.api";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { selectClassNameCompact } from "@/lib/form-styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PROJECT_COLORS = ["#188433", "#fa5d00", "#2d6ec8", "#6b4fbb", "#c23b3b"];

export function MastersPanel() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [projectDialog, setProjectDialog] = useState<Project | "new" | null>(
    null,
  );
  const [taskDialog, setTaskDialog] = useState<Task | "new" | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "project"; item: Project } | { type: "task"; item: Task } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: projectsQueryKey,
    queryFn: listProjects,
    enabled: user?.role === "ADMIN",
  });

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey(selectedProjectId ?? undefined),
    queryFn: () => listTasks(selectedProjectId ?? undefined),
    enabled: user?.role === "ADMIN" && Boolean(selectedProjectId),
  });

  const projects = projectsQuery.data ?? [];
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (
      !selectedProjectId ||
      !projects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const projectMutation = useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      color: string;
      isActive: boolean;
    }) => {
      if (input.id) {
        return updateProject(input.id, input);
      }
      return createProject(input);
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      setSelectedProjectId(project.id);
      setProjectDialog(null);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Unable to save the project.",
      );
    },
  });

  const taskMutation = useMutation({
    mutationFn: async (input: {
      id?: string;
      projectId: string;
      name: string;
      isActive: boolean;
    }) => {
      if (input.id) {
        return updateTask(input.id, input);
      }
      return createTask(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskDialog(null);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Unable to save the task.",
      );
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: async (_result, deletedId) => {
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (selectedProjectId === deletedId) {
        setSelectedProjectId(null);
      }
      setDeleteTarget(null);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Unable to delete the project.",
      );
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDeleteTarget(null);
      setError(null);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError ? err.message : "Unable to delete the task.",
      );
    },
  });

  if (!user) {
    return null;
  }

  if (user.role !== "ADMIN") {
    return (
      <p className="text-muted-foreground">
        Only an admin can manage projects and tasks.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Masters</h1>
        <p className="mt-1 text-muted-foreground">
          Create, edit, and delete projects and their tasks.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Projects</h2>
            <Button
              size="sm"
              className="bg-[#188433] text-white hover:bg-[#14732c]"
              onClick={() => {
                setError(null);
                setProjectDialog("new");
              }}
            >
              <Plus />
              Add project
            </Button>
          </div>
          <ul className="space-y-1">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                    selectedProjectId === project.id && "bg-muted font-medium",
                  )}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {!project.isActive ? (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      Off
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit ${project.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setError(null);
                      setProjectDialog(project);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${project.name}`}
                    className="text-destructive hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      setError(null);
                      setDeleteTarget({ type: "project", item: project });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">
              Task types
              {selectedProject ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  for {selectedProject.name}
                </span>
              ) : null}
            </h2>
            <Button
              size="sm"
              className="bg-[#188433] text-white hover:bg-[#14732c]"
              disabled={!selectedProject}
              onClick={() => {
                setError(null);
                setTaskDialog("new");
              }}
            >
              <Plus />
              Add task type
            </Button>
          </div>
          <ul className="space-y-1">
            {(tasksQuery.data ?? []).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{task.name}</span>
                {!task.isActive ? (
                  <span className="text-[10px] uppercase text-muted-foreground">
                    Off
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Edit ${task.name}`}
                  onClick={() => {
                    setError(null);
                    setTaskDialog(task);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${task.name}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setError(null);
                    setDeleteTarget({ type: "task", item: task });
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
            {selectedProject && (tasksQuery.data ?? []).length === 0 ? (
              <li className="px-3 py-6 text-sm text-muted-foreground">
                No tasks yet. Add ones like Development, QA Testing, or
                Client Support.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <ProjectDialog
        open={projectDialog !== null}
        project={projectDialog === "new" ? null : projectDialog}
        pending={projectMutation.isPending}
        onClose={() => setProjectDialog(null)}
        onSave={(values) => {
          projectMutation.mutate({
            id: projectDialog === "new" ? undefined : projectDialog?.id,
            ...values,
          });
        }}
      />

      <TaskDialog
        open={taskDialog !== null}
        task={taskDialog === "new" ? null : taskDialog}
        projects={projects}
        defaultProjectId={selectedProjectId}
        pending={taskMutation.isPending}
        onClose={() => setTaskDialog(null)}
        onSave={(values) => {
          taskMutation.mutate({
            id: taskDialog === "new" ? undefined : taskDialog?.id,
            ...values,
          });
        }}
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.type === "project"
            ? "Delete project?"
            : "Delete task?"
        }
        description={
          deleteTarget?.type === "project"
            ? `This will permanently delete "${deleteTarget.item.name}" and all tasks under it.`
            : `This will permanently delete "${deleteTarget?.item.name}".`
        }
        pending={deleteProjectMutation.isPending || deleteTaskMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }

          if (deleteTarget.type === "project") {
            deleteProjectMutation.mutate(deleteTarget.item.id);
            return;
          }

          deleteTaskMutation.mutate(deleteTarget.item.id);
        }}
      />
    </div>
  );
}

function DeleteConfirmDialog({
  open,
  title,
  description,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({
  open,
  project,
  pending,
  onClose,
  onSave,
}: {
  open: boolean;
  project: Project | null;
  pending: boolean;
  onClose: () => void;
  onSave: (values: { name: string; color: string; isActive: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#188433");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(project?.name ?? "");
    setColor(project?.color ?? "#188433");
    setIsActive(project?.isActive ?? true);
  }, [open, project]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "Add project"}</DialogTitle>
          <DialogDescription>
            Projects group the tasks people can log time against.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              return;
            }
            onSave({ name: name.trim(), color, isActive });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Client Delivery"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={value}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-background",
                    color === value && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: value }}
                  onClick={() => setColor(value)}
                />
              ))}
            </div>
          </div>
          {project ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#188433] text-white hover:bg-[#14732c]"
              disabled={pending || !name.trim()}
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({
  open,
  task,
  projects,
  defaultProjectId,
  pending,
  onClose,
  onSave,
}: {
  open: boolean;
  task: Task | null;
  projects: Project[];
  defaultProjectId: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (values: {
    projectId: string;
    name: string;
    isActive: boolean;
  }) => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }
    setProjectId(task?.projectId ?? defaultProjectId ?? "");
    setName(task?.name ?? "");
    setIsActive(task?.isActive ?? true);
  }, [open, task, defaultProjectId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit task type" : "Add task type"}
          </DialogTitle>
          <DialogDescription>
            Task types are the jobs done on a project, such as Development or
            QA Testing.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !projectId) {
              return;
            }
            onSave({ projectId, name: name.trim(), isActive });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-project">Project</Label>
            <select
              id="task-project"
              className={selectClassNameCompact}
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-name">Task type</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Feature Development"
            />
          </div>
          {task ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Active
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#188433] text-white hover:bg-[#14732c]"
              disabled={pending || !name.trim() || !projectId}
            >
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
