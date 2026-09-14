export type SiteStatus = "online" | "offline" | "attention";
export type PowerSource = "commercial" | "genset";
export type SiteOwner = "infinivan" | "coloc";

export interface Cctv {
  name: string;
  url: string;
}

export interface Node {
  id: string;
  name: string;
  address: string;
  region: string;
  status: SiteStatus;
  powerSource: PowerSource;
  voltage: number;
  fuelLevel: number;
  temperature: number;
  humidity: number;
  lastPMS: string;
  siteOwner: SiteOwner;
  cctv: Cctv[];
  lat: number;
  lng: number;
}

export const MAP_CENTER: [number, number] = [122.3, 12.5];

export const statusLabel = (status: SiteStatus) =>
  status === "online" ? "Online" : status === "offline" ? "Offline" : "Attention";

export const statusDot = (status: SiteStatus) =>
  status === "online"
    ? "bg-emerald-500"
    : status === "offline"
      ? "bg-red-500"
      : "bg-orange-500";

export const powerLabel = (source: PowerSource) =>
  source === "commercial" ? "Commercial power" : "Genset";

export const ownerLabel = (owner: SiteOwner) =>
  owner === "infinivan" ? "Infinivan" : "Coloc";

export const formatLastPMS = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
    status: "online",
    powerSource: "commercial",
    voltage: 230,
    fuelLevel: 85,
    temperature: 26.4,
    humidity: 62,
    lastPMS: "2025-08-12",
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
    status: "attention",
    powerSource: "genset",
    voltage: 218,
    fuelLevel: 32,
    temperature: 28.1,
    humidity: 71,
    lastPMS: "2025-06-30",
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
    status: "online",
    powerSource: "commercial",
    voltage: 232,
    fuelLevel: 92,
    temperature: 29.7,
    humidity: 68,
    lastPMS: "2025-09-02",
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
    status: "offline",
    powerSource: "genset",
    voltage: 198,
    fuelLevel: 8,
    temperature: 30.2,
    humidity: 74,
    lastPMS: "2025-04-18",
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
    status: "attention",
    powerSource: "commercial",
    voltage: 224,
    fuelLevel: 41,
    temperature: 27.9,
    humidity: 76,
    lastPMS: "2025-07-22",
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
    status: "online",
    powerSource: "genset",
    voltage: 240,
    fuelLevel: 64,
    temperature: 28.6,
    humidity: 80,
    lastPMS: "2025-08-28",
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
];