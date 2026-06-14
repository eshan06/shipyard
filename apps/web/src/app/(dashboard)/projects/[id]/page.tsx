"use client";

import {
  Archive,
  ArrowLeft,
  Boxes,
  ExternalLink,
  FolderRoot,
  GitBranch,
  Github,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";



import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { usePreviews, useProject } from "@/lib/hooks";
import { absoluteTime } from "@/lib/time";

import { EnvManager } from "./_components/env-manager";
import { SeedManager } from "./_components/seed-manager";
import {
  DangerZoneCard,
  DeploySettingsCard,
} from "./_components/settings-form";

import type { Project } from "@/lib/api-types";

/** A labelled key/value pair in the overview repository card. */
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm font-medium">
        {children}
      </span>
    </div>
  );
}

/** The detail-page header: back link, name, repo, archive badge, GitHub link. */
function ProjectDetailHeader({
  project,
}: {
  project: Project;
}): React.JSX.Element {
  const router = useRouter();
  const repoUrl =
    project.provider.toLowerCase() === "github"
      ? `https://github.com/${project.repoFullName}`
      : null;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => router.push("/projects")}
      >
        <ArrowLeft className="size-4" />
        Projects
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h2>
            {project.isArchived ? (
              <Badge variant="muted" className="gap-1">
                <Archive className="size-3" />
                Archived
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Github className="size-3.5" />
              <span className="font-mono">{project.repoFullName}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="size-3.5" />
              <span className="font-mono">{project.defaultBranch}</span>
            </span>
            {project.framework ? (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="size-3.5" />
                <span className="capitalize">{project.framework}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {repoUrl ? (
            <Button asChild variant="outline">
              <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                <Github className="size-4" />
                Repository
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/previews?projectId=${project.id}`}>
              <Boxes className="size-4" />
              Previews
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The Overview tab: repository facts + a snapshot of deploy settings. */
function OverviewTab({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}): React.JSX.Element {
  const previews = usePreviews({ projectId: project.id, limit: 100 });
  const previewCount = previews.data?.data.length;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Repository</CardTitle>
          <CardDescription>
            Source-control connection and build location.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow icon={<Github className="size-4" />} label="Repository">
            <span className="font-mono">{project.repoFullName}</span>
          </InfoRow>
          <InfoRow icon={<span aria-hidden>·</span>} label="Provider">
            <span className="capitalize">{project.provider}</span>
          </InfoRow>
          <InfoRow icon={<GitBranch className="size-4" />} label="Default branch">
            <span className="font-mono">{project.defaultBranch}</span>
          </InfoRow>
          <InfoRow icon={<Layers className="size-4" />} label="Framework">
            {project.framework ? (
              <span className="capitalize">{project.framework}</span>
            ) : (
              <span className="text-muted-foreground">Auto-detect</span>
            )}
          </InfoRow>
          <InfoRow icon={<FolderRoot className="size-4" />} label="Root directory">
            <span className="font-mono">{project.rootDirectory || "/"}</span>
          </InfoRow>
          <InfoRow icon={<Boxes className="size-4" />} label="Active previews">
            {previews.isLoading ? (
              <Skeleton className="ml-auto h-4 w-8" />
            ) : (
              <span>{previewCount ?? 0}</span>
            )}
          </InfoRow>
          <InfoRow icon={<span aria-hidden>·</span>} label="Created">
            <span className="text-muted-foreground">
              {absoluteTime(project.createdAt)}
            </span>
          </InfoRow>
        </CardContent>
      </Card>

      <DeploySettingsCard project={project} onSaved={onSaved} />
    </div>
  );
}

/**
 * The Project detail page: a header (repo info, archive badge, repo/previews
 * links) and four tabs — Overview (repository facts + editable deployment
 * settings), Environment Variables & Secrets (full CRUD with masked secrets),
 * Seed Templates (CRUD + default), and Settings (deployment settings + danger
 * zone). Renders loading and error states.
 */
export default function ProjectDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: project, error, isLoading, mutate } = useProject(id);

  if (error) {
    return (
      <ErrorState
        title="Couldn't load project"
        description={error.message}
        onRetry={() => void mutate()}
      />
    );
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-9 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const refresh = (): void => {
    void mutate();
  };

  return (
    <div className="space-y-8">
      <ProjectDetailHeader project={project} />

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="env">Environment</TabsTrigger>
          <TabsTrigger value="seeds">Seed templates</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab project={project} onSaved={refresh} />
        </TabsContent>

        <TabsContent value="env" className="mt-6">
          <EnvManager projectId={project.id} />
        </TabsContent>

        <TabsContent value="seeds" className="mt-6">
          <SeedManager projectId={project.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-6">
          <DeploySettingsCard project={project} onSaved={refresh} />
          <DangerZoneCard project={project} onChanged={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
