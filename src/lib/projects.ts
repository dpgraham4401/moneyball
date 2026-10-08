/** A construction project. Every dashboard lives under one. */
export type Project = {
  slug: string;
  name: string;
  /** CSV in `data/` holding this project's payroll today; a database would replace this. */
  payrollFile: string;
};

// ponytail: hard-coded single project until there are users and a database to store projects in.
export const PROJECTS: Project[] = [
  { slug: "my-project", name: "My project", payrollFile: "payroll_data.csv" },
];

export const DEFAULT_PROJECT_SLUG = PROJECTS[0].slug;

export const getProject = (slug: string) => PROJECTS.find((project) => project.slug === slug);

/** URL builders, so links don't hand-assemble project paths. */
export const projectPaths = {
  payroll: (projectSlug: string) => `/projects/${projectSlug}/payroll`,
  employee: (projectSlug: string, employeeId: string) =>
    `/projects/${projectSlug}/payroll/employees/${employeeId}`,
};
