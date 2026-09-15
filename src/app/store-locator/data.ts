export type SiteStatus = "online" | "offline" | "critical";
export type PowerSource = "commercial" | "genset";
export type SiteOwner = "infinivan" | "coloc";
export type CoolingStatus = "on" | "off";

const STALE_MS = 60_000;

export interface Cctv {
  name: string;
  url: string;
}

export interface Node {
  id: string;
  name: string;
  address: string;
  region: string;
  powerSource: PowerSource;
  voltage: number;
  fuelLevel: number;
  temperature: number;
  humidity: number;
  cooling: CoolingStatus;
  coolingAmps: number;
  lastPMS: string;
  lastDataAt: string;
  siteOwner: SiteOwner;
  cctv: Cctv[];
  lat: number;
  lng: number;
}

export const MAP_CENTER: [number, number] = [122.3, 12.5];

export const statusLabel = (status: SiteStatus) =>
  status === "online" ? "Online" : status === "offline" ? "Offline" : "Critical";

export const statusDot = (status: SiteStatus) =>
  status === "online"
    ? "bg-emerald-500"
    : status === "offline"
      ? "bg-red-500"
      : "bg-yellow-500";

// When the node was last seen (the detection time for its offline status).
export function offlineDetectedAt(node: Node): Date {
  return new Date(new Date(node.lastDataAt).getTime() + STALE_MS);
}

// Deterministic minutes from now until the node is expected to recover.
export function nodeRecoveryMinutes(node: Node): number {
  return 2 + (hashString(node.id) % 11);
}

export const powerLabel = (source: PowerSource) =>
  source === "commercial" ? "Commercial power" : "Genset";

export const ownerLabel = (owner: SiteOwner) =>
  owner === "infinivan" ? "Infinivan" : "Coloc";

export const coolingLabel = (cooling: CoolingStatus) =>
  cooling === "on" ? "ON" : "OFF";

export const formatLastPMS = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function offlineDuration(since: string): string {
  const minutes = Math.floor(
    Math.max(0, Date.now() - new Date(since).getTime()) / 60_000,
  );
  if (minutes <= 0) return "0m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

const dataAt = (secondsAgo: number) =>
  new Date(Date.now() - secondsAgo * 1000).toISOString();

export function isStale(node: Node): boolean {
  return Date.now() - new Date(node.lastDataAt).getTime() > STALE_MS;
}

export function deriveStatus(node: Node): SiteStatus {
  if (isStale(node)) return "offline";
  if (node.powerSource === "genset") return "critical";
  if (node.powerSource === "commercial" && node.voltage < 220) return "critical";
  if (node.fuelLevel < 15) return "critical";
  if (node.temperature > 30) return "critical";
  if (node.humidity > 70 || node.humidity < 30) return "critical";
  if (node.cooling === "off") return "critical";
  return "online";
}

export type CriticalIssue =
  | "genset"
  | "lowVoltage"
  | "lowFuel"
  | "highTemp"
  | "humidity"
  | "coolingOff";

export function criticalIssues(node: Node): CriticalIssue[] {
  const issues: CriticalIssue[] = [];
  if (node.powerSource === "genset") issues.push("genset");
  if (node.powerSource === "commercial" && node.voltage < 220) issues.push("lowVoltage");
  if (node.fuelLevel < 15) issues.push("lowFuel");
  if (node.temperature > 30) issues.push("highTemp");
  if (node.humidity > 70 || node.humidity < 30) issues.push("humidity");
  if (node.cooling === "off") issues.push("coolingOff");
  return issues;
}

export type NodeNotificationStatus = SiteStatus;

export interface NodeNotification {
  id: string;
  nodeId: string;
  nodeName: string;
  status: NodeNotificationStatus;
  detectedAt: Date;
  detail: string;
}

const CRITICAL_ISSUE_LABEL: Record<CriticalIssue, string> = {
  genset: "Running on generator power",
  lowVoltage: "Grid voltage below 220 V",
  lowFuel: "Fuel level below 15%",
  highTemp: "Ambient temperature above 30 °C",
  humidity: "Humidity out of recommended range",
  coolingOff: "Cooling system is off",
};

const CRITICAL_DETAIL: Record<CriticalIssue, string> = {
  genset: "running on genset",
  lowVoltage: "low voltage",
  lowFuel: "low fuel",
  highTemp: "high room temperature",
  humidity: "High room humidity",
  coolingOff: "air cooling unit is off",
};

export function criticalDetails(node: Node): string[] {
  return criticalIssues(node).map((issue) => CRITICAL_DETAIL[issue]);
}

export function criticalLabels(node: Node): string[] {
  return criticalIssues(node).map((issue) => CRITICAL_ISSUE_LABEL[issue]);
}

export const formatDetectedAt = (date: Date) => ({
  date: date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  time: date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }),
});

// Deterministic, latest-first timeline of online/critical/offline notifications.
export function nodeNotifications(siteNodes: Node[]): NodeNotification[] {
  const list: NodeNotification[] = [];
  for (const node of siteNodes) {
    const status = deriveStatus(node);
    if (status === "offline") {
      list.push({
        id: `${node.id}:offline`,
        nodeId: node.id,
        nodeName: node.name,
        status: "offline",
        detectedAt: new Date(new Date(node.lastDataAt).getTime() + STALE_MS),
        detail: "Node went offline",
      });
    } else if (status === "online") {
      const recoveredAt = Date.now() - (300 + (hashString(node.id) % 3600)) * 1000;
      list.push({
        id: `${node.id}:online`,
        nodeId: node.id,
        nodeName: node.name,
        status: "online",
        detectedAt: new Date(recoveredAt),
        detail: "Node went online from offline state",
      });
    } else if (status === "critical") {
      const issues = criticalIssues(node);
      const base = 120 + (hashString(node.id) % 1800);
      issues.forEach((issue, index) => {
        list.push({
          id: `${node.id}:${issue}`,
          nodeId: node.id,
          nodeName: node.name,
          status: "critical",
          detectedAt: new Date(Date.now() - (base + index * 23) * 1000),
          detail: CRITICAL_ISSUE_LABEL[issue],
        });
      });
    }
  }
  return list.sort(
    (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime(),
  );
}

export interface DataPoint {
  time: Date;
  value: number;
}

export type SeriesKey =
  | "voltage"
  | "fuelLevel"
  | "temperature"
  | "humidity"
  | "coolingAmps";

export const seriesLabel: Record<SeriesKey, string> = {
  voltage: "Voltage",
  fuelLevel: "Fuel Level",
  temperature: "Temperature",
  humidity: "Humidity",
  coolingAmps: "Cooling Amps",
};

export const seriesUnit: Record<SeriesKey, string> = {
  voltage: "V",
  fuelLevel: "%",
  temperature: "°C",
  humidity: "%",
  coolingAmps: "A",
};

const HOUR_COUNT = 24;

const SERIES_PROFILE: Record<
  SeriesKey,
  { amplitude: number; min: number; max: number }
> = {
  voltage: { amplitude: 6, min: 195, max: 250 },
  fuelLevel: { amplitude: 4, min: 0, max: 100 },
  temperature: { amplitude: 2.5, min: 5, max: 45 },
  humidity: { amplitude: 8, min: 5, max: 100 },
  coolingAmps: { amplitude: 0.12, min: 0, max: 5 },
};

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 24-hour hourly series for a node attribute. The last point is
// the node's current value so the chart stays consistent with the derived
// node status.
export function hourlySeries(node: Node, key: SeriesKey): DataPoint[] {
  const { amplitude, min, max } = SERIES_PROFILE[key];
  const rand = mulberry32(hashString(`${node.id}:${key}`));
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  const current = node[key];
  const values: number[] = [current];
  for (let i = 1; i < HOUR_COUNT; i++) {
    const next = values[i - 1] + (rand() - 0.5) * 2 * amplitude;
    values.push(Math.min(max, Math.max(min, next)));
  }
  return values.map((value, i) => ({
    time: new Date(hourStart.getTime() - (HOUR_COUNT - 1 - i) * 3_600_000),
    value,
  }));
}

export interface RegionCluster {
  region: string;
  count: number;
}

export const clusterByRegion = (siteNodes: Node[]): RegionCluster[] => {
  const counts = new Map<string, number>();
  for (const node of siteNodes) {
    counts.set(node.region, (counts.get(node.region) ?? 0) + 1);
  }
  return [...counts.entries()].map(([region, count]) => ({ region, count }));
};

export const nodes: Node[] = [
  {
    id: "mnl-makati",
    name: "Makati Node",
    address: "Ayala Triangle, Makati, Metro Manila",
    region: "NCR",
    powerSource: "commercial",
    voltage: 230,
    fuelLevel: 85,
    temperature: 26.4,
    humidity: 62,
    cooling: "on",
    coolingAmps: 1.033,
    lastPMS: "2025-08-12",
    lastDataAt: dataAt(25),
    siteOwner: "infinivan",
    cctv: [
      {
        name: "Front Gate Cam",
        url: "rtsp://203.0.113.1:554/front-gate",
      },
      {
        name: "Generator Room Cam",
        url: "rtsp://203.0.113.1:554/genset-room",
      },
    ],
    lat: 14.5547,
    lng: 121.0244,
  },
  {
    id: "mnl-quezon-city",
    name: "Quezon City Node",
    address: "Eastwood City, Quezon City, Metro Manila",
    region: "NCR",
    powerSource: "genset",
    voltage: 218,
    fuelLevel: 32,
    temperature: 28.1,
    humidity: 38,
    cooling: "on",
    coolingAmps: 1.096,
    lastPMS: "2025-06-30",
    lastDataAt: dataAt(30),
    siteOwner: "coloc",
    cctv: [
      {
        name: "Roof Cam",
        url: "rtsp://198.51.100.10:554/roof",
      },
    ],
    lat: 14.609,
    lng: 121.058,
  },
  {
    id: "cebu",
    name: "Cebu Node",
    address: "IT Park, Cebu City",
    region: "Central Visayas",
    powerSource: "commercial",
    voltage: 232,
    fuelLevel: 92,
    temperature: 29.7,
    humidity: 64,
    cooling: "on",
    coolingAmps: 1.158,
    lastPMS: "2025-09-02",
    lastDataAt: dataAt(20),
    siteOwner: "infinivan",
    cctv: [
      {
        name: "Datahall Cam",
        url: "rtsp://198.51.100.20:554/datahall",
      },
    ],
    lat: 10.3157,
    lng: 123.8854,
  },
  {
    id: "davao",
    name: "Davao Node",
    address: "Bajada, Davao City",
    region: "Davao",
    powerSource: "commercial",
    voltage: 225,
    fuelLevel: 9,
    temperature: 29.4,
    humidity: 60,
    cooling: "on",
    coolingAmps: 0.987,
    lastPMS: "2025-04-18",
    lastDataAt: dataAt(15),
    siteOwner: "coloc",
    cctv: [],
    lat: 7.079,
    lng: 125.6129,
  },
  {
    id: "iloilo",
    name: "Iloilo Node",
    address: "Mustang Business District, Mandurriao, Iloilo City",
    region: "Western Visayas",
    powerSource: "commercial",
    voltage: 230,
    fuelLevel: 60,
    temperature: 33,
    humidity: 40,
    cooling: "off",
    coolingAmps: 0,
    lastPMS: "2025-07-22",
    lastDataAt: dataAt(35),
    siteOwner: "infinivan",
    cctv: [
      {
        name: "Main Entrance Cam",
        url: "rtsp://203.0.113.2:554/main-entrance",
      },
      {
        name: "Parking Cam",
        url: "rtsp://203.0.113.2:554/parking",
      },
    ],
    lat: 10.7202,
    lng: 122.5621,
  },
  {
    id: "cagayan-de-oro",
    name: "Cagayan de Oro Node",
    address: "Limketkai Center, Cagayan de Oro",
    region: "Northern Mindanao",
    powerSource: "commercial",
    voltage: 228,
    fuelLevel: 76,
    temperature: 28.2,
    humidity: 58,
    cooling: "on",
    coolingAmps: 1.041,
    lastPMS: "2025-08-28",
    lastDataAt: dataAt(18),
    siteOwner: "coloc",
    cctv: [
      {
        name: "Perimeter Cam",
        url: "rtsp://198.51.100.30:554/perimeter",
      },
    ],
    lat: 8.4967,
    lng: 124.6118,
  },
  {
    id: "zamboanga",
    name: "Zamboanga Node",
    address: "Culianan Ave, Zamboanga City",
    region: "Zamboanga Peninsula",
    powerSource: "genset",
    voltage: 238,
    fuelLevel: 55,
    temperature: 27.4,
    humidity: 65,
    cooling: "on",
    coolingAmps: 1.102,
    lastPMS: "2025-05-10",
    lastDataAt: dataAt(1500),
    siteOwner: "infinivan",
    cctv: [
      {
        name: "Front Gate Cam",
        url: "rtsp://203.0.113.3:554/front-gate",
      },
    ],
    lat: 6.9214,
    lng: 122.079,
  },
  {
    id: "tuguegarao",
    name: "Tuguegarao Node",
    address: "Rizal St, Tuguegarao City",
    region: "Cagayan Valley",
    powerSource: "commercial",
    voltage: 210,
    fuelLevel: 40,
    temperature: 31.5,
    humidity: 66,
    cooling: "off",
    coolingAmps: 0,
    lastPMS: "2025-03-22",
    lastDataAt: dataAt(480),
    siteOwner: "coloc",
    cctv: [],
    lat: 17.6131,
    lng: 121.7269,
  },
];