"use client";

import { useEffect, useRef } from "react";
import {
  Building2,
  CalendarDays,
  Droplets,
  Fuel,
  Gauge,
  MapPin,
  PanelLeftClose,
  Search,
  Snowflake,
  Thermometer,
  Zap,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  clusterByRegion,
  criticalIssues,
  deriveStatus,
  formatLastPMS,
  offlineDuration,
  ownerLabel,
  statusDot,
  statusLabel,
  type CriticalIssue,
  type Node as SiteNode,
  type SiteStatus,
} from "../data";

const STATUSES: SiteStatus[] = ["online", "offline", "critical"];

const ISSUE_ICON: Record<CriticalIssue, typeof Fuel> = {
  genset: Fuel,
  lowVoltage: Zap,
  lowFuel: Gauge,
  highTemp: Thermometer,
  humidity: Droplets,
  coolingOff: Snowflake,
};

interface StoreListProps {
  nodes: SiteNode[];
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: SiteStatus | null;
  onStatusFilterChange: (status: SiteStatus | null) => void;
  statusCounts: Record<SiteStatus, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StoreList({
  nodes,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
  selectedId,
  onSelect,
}: StoreListProps) {
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    if (!selectedId) return;
    itemRefs.current
      .get(selectedId)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <Sidebar collapsible="offcanvas" variant="floating">
      <SidebarHeader className="gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              Node locations
            </h2>
            <p className="text-muted-foreground text-sm">
              {nodes.length} {nodes.length === 1 ? "node" : "nodes"} ·{" "}
              {clusterByRegion(nodes)
                .map(({ region, count }) => `${count} ${region}`)
                .join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Hide sidebar"
            className="hover:bg-sidebar-accent text-sidebar-foreground hidden rounded-md p-1.5 transition-colors md:inline-flex"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search name or address"
            className="bg-background pl-8"
            aria-label="Search nodes"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUSES.map((status) => {
            const active = statusFilter === status;
            return (
              <Button
                key={status}
                type="button"
                size="xs"
                variant={active ? "secondary" : "ghost"}
                onClick={() =>
                  onStatusFilterChange(active ? null : status)
                }
                aria-pressed={active}
                className={cn(
                  "gap-1.5 px-2",
                  active && "ring-ring ring-1",
                )}
              >
                <span
                  className={cn("size-2.5 rounded-full", statusDot(status))}
                />
                {statusLabel(status)} {statusCounts[status]}
              </Button>
            );
          })}
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        {nodes.length === 0 ? (
          <div className="text-muted-foreground p-6 text-center text-sm">
            No nodes match your search.
          </div>
        ) : (
          <SidebarGroup className="p-2">
            <SidebarMenu className="gap-1">
              {nodes.map((node) => {
                const active = node.id === selectedId;
                const status = deriveStatus(node);
                return (
                  <SidebarMenuItem key={node.id}>
                    <SidebarMenuButton
                      isActive={active}
                      className="h-auto flex-col items-stretch gap-0 p-3"
                      render={
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) itemRefs.current.set(node.id, el);
                            else itemRefs.current.delete(node.id);
                          }}
                          onClick={() => onSelect(node.id)}
                          aria-current={active}
                        />
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground font-medium">
                          {node.name}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-medium">
<span
  className={cn(
    "rounded-full px-2 py-0.5",
    statusDot(status),
    status === "offline" && "font-bold",
  )}
>
  <span className="text-black dark:text-white">
    {statusLabel(status)}
  </span>
</span>
{status === "critical" && (
  <span className="flex items-center gap-1">
    {criticalIssues(node).map((issue) => {
      const Icon = ISSUE_ICON[issue];
      return (
        <Icon
          key={issue}
          className="text-black dark:text-white size-3.5"
        />
      );
    })}
  </span>
)}
{status === "offline" && (
  <span className="text-red-600 dark:text-white">
    {offlineDuration(node.lastDataAt)}
  </span>
)}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-2 space-y-1.5 text-xs font-normal tabular-nums">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" />
                          {node.address}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5 shrink-0" />
                          Last PMS {formatLastPMS(node.lastPMS)}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 shrink-0" />
                          {ownerLabel(node.siteOwner)}
                        </p>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}