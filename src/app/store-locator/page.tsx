"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { StoreList } from "./components/store-list";
import { LocatorMap } from "./components/locator-map";
import { MAP_CENTER, deriveStatus, nodes, type SiteStatus } from "./data";

export default function Page() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SiteStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(nodes[0].id);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<SiteStatus, number> = {
      online: 0,
      offline: 0,
      attention: 0,
    };
    for (const node of nodes) counts[deriveStatus(node)] += 1;
    return counts;
    // Re-evaluate on the tick: deriveStatus reads the current time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((node) => {
      const status = deriveStatus(node);
      if (statusFilter && status !== statusFilter) return false;
      if (!q) return true;
      return (
        node.name.toLowerCase().includes(q) ||
        node.address.toLowerCase().includes(q) ||
        node.siteOwner.includes(q)
      );
    });
    // Re-evaluate on the tick: deriveStatus reads the current time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, now]);

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