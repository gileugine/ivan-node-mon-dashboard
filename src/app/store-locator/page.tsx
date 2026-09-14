"use client";

import { useMemo, useState, type CSSProperties } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { StoreList } from "./components/store-list";
import { LocatorMap } from "./components/locator-map";
import { MAP_CENTER, nodes, type SiteStatus } from "./data";

export default function Page() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SiteStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0].id);

  const statusCounts = useMemo(() => {
    const counts: Record<SiteStatus, number> = {
      online: 0,
      offline: 0,
      attention: 0,
    };
    for (const node of nodes) counts[node.status] += 1;
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((node) => {
      if (statusFilter && node.status !== statusFilter) return false;
      if (!q) return true;
      return (
        node.name.toLowerCase().includes(q) ||
        node.address.toLowerCase().includes(q) ||
        node.siteOwner.includes(q)
      );
    });
  }, [query, statusFilter]);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "20rem" } as CSSProperties}
    >
      <StoreList
        nodes={filtered}
        query={query}
        onQueryChange={setQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusCounts={statusCounts}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <SidebarInset>
        <LocatorMap
          nodes={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClearSelection={() => setSelectedId(null)}
          center={MAP_CENTER}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}