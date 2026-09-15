"use client";

import Hls from "hls.js";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Bell,
  CircleMinus,
  Droplets,
  Fuel,
  MapPin,
  Pin,
  Snowflake,
  Thermometer,
  TriangleAlert,
  Video,
  VideoOff,
  X,
  Zap,
} from "lucide-react";

import {
  Map,
  MapControls,
  MapMarker,
  MapPopup,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from "@/components/ui/map";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  coolingLabel,
  deriveStatus,
  formatDetectedAt,
  hourlySeries,
  nodeNotifications,
  offlineDuration,
  seriesLabel,
  seriesUnit,
  statusDot,
  statusLabel,
  type Cctv,
  type DataPoint,
  type Node as SiteNode,
  type NodeNotification,
  type SeriesKey,
} from "../data";
import type { SiteStatus } from "../data";

const SAMPLE_STREAM =
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

interface LocatorMapProps {
  nodes: SiteNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  center: [number, number];
}

interface CctvCardData {
  id: string;
  cctvName: string;
  url: string;
  nodeName: string;
}

interface ChartCardData {
  id: string;
  nodeId: string;
  attribute: SeriesKey;
  pinned: boolean;
}

const CCTV_MARGIN = 30;
const CCTV_CARD_WIDTH = 320;
const CCTV_STACK_OFFSET = 26;
const CHART_STACK_OFFSET = 28;

const PIN_COLOR: Record<SiteStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  attention: "bg-yellow-500",
};

const SERIES_STROKE: Record<SeriesKey, string> = {
  voltage: "stroke-sky-500",
  fuelLevel: "stroke-amber-500",
  temperature: "stroke-red-500",
  humidity: "stroke-blue-500",
  coolingAmps: "stroke-cyan-500",
};

const SERIES_ICON: Record<SeriesKey, typeof MapPin> = {
  voltage: Zap,
  fuelLevel: Fuel,
  temperature: Thermometer,
  humidity: Droplets,
  coolingAmps: Snowflake,
};

function AttributeIcon({ attribute }: { attribute: SeriesKey }) {
  const Icon = SERIES_ICON[attribute];
  return <Icon className="text-muted-foreground size-3.5 shrink-0" />;
}

function useDragOffset() {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.dx,
      originY: offset.dy,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      dx: drag.originX + (e.clientX - drag.startX),
      dy: drag.originY + (e.clientY - drag.startY),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return { offset, onPointerDown, onPointerMove, endDrag };
}

function FlyToSelected({ node }: { node?: SiteNode }) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || !node) return;
    map.flyTo({
      center: [node.lng, node.lat],
      zoom: 14,
      duration: 800,
      essential: true,
    });
  }, [map, node]);

  return null;
}

const PIN_ICON: Record<SiteStatus, typeof MapPin> = {
  online: MapPin,
  offline: CircleMinus,
  attention: TriangleAlert,
};

function StorePin({ status, active }: { status: SiteStatus; active: boolean }) {
  const Icon = PIN_ICON[status];
  return (
    <div className="relative">
      {status === "attention" && (
        <span
          aria-hidden
          className="bg-yellow-500/50 pointer-events-none absolute inset-0 animate-ping rounded-full"
        />
      )}
      <div
        className={cn(
          "text-background relative flex items-center justify-center rounded-full shadow-md transition-all",
          PIN_COLOR[status],
          active
            ? "ring-ring size-9 scale-110 ring-2"
            : "size-7 hover:brightness-110",
        )}
      >
        <Icon className={cn(active ? "size-4.5" : "size-3.5")} />
      </div>
    </div>
  );
}

function CctvFeed({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isRtsp = url.startsWith("rtsp:");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // RTSP is not playable in the browser directly; show a sample public
    // stream as a placeholder until the RTSP gateway is wired up.
    const src = isRtsp ? SAMPLE_STREAM : url;
    let hls: Hls | null = null;

    if (src.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => {});
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      }
    } else {
      video.src = src;
    }

    return () => {
      hls?.destroy();
    };
  }, [url, isRtsp]);

  return (
    <div className="relative aspect-video bg-black">
      <video
        ref={videoRef}
        className="size-full object-cover"
        muted
        autoPlay
        playsInline
        loop
        controls
      />
      {isRtsp && (
        <span className="bg-black/60 text-muted-foreground absolute top-1.5 right-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
          RTSP preview
        </span>
      )}
    </div>
  );
}

function CctvCard({
  card,
  stackIndex,
  onClose,
  left,
  top,
}: {
  card: CctvCardData;
  stackIndex: number;
  onClose: () => void;
  left: number;
  top: number;
}) {
  const { offset, onPointerDown, onPointerMove, endDrag } = useDragOffset();

  return (
    <div
      className="bg-background text-foreground absolute z-[1000] w-80 overflow-hidden rounded-lg border border-border shadow-2xl"
      style={{
        top: top + stackIndex * CCTV_STACK_OFFSET,
        left,
        transform: `translate(${offset.dx}px, ${offset.dy}px)`,
      }}
    >
      <div
        className="bg-muted/70 flex cursor-grab touch-none items-center justify-between gap-2 border-b border-border px-3 py-2 select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="text-foreground truncate text-xs font-medium">
          {card.cctvName} · {card.nodeName}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close CCTV feed"
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
      <CctvFeed url={card.url} />
    </div>
  );
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function HourlyChart({
  points,
  strokeClass,
  onHover,
}: {
  points: DataPoint[];
  strokeClass: string;
  onHover?: (point: DataPoint | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { width, height } = useElementSize(containerRef);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (width < 2 || height < 2) {
    return <div ref={containerRef} className="relative size-full" />;
  }

  const count = points.length;
  const fontSize = Math.max(8, Math.min(13, width / 32));
  const padX = Math.min(width * 0.16, Math.max(18, fontSize * 3.8));
  const padTop = Math.max(8, height * 0.09);
  const padBottom = Math.max(fontSize * 3.2, height * 0.14);
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-6) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  const lo = min - pad;
  const hi = max + pad;

  const x = (i: number) => padX + (i / (count - 1)) * plotW;
  const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo)) * plotH;

  const path = points
    .map((p, i) =>
      `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`,
    )
    .join(" ");

  // Rotated labels take ~fontSize px horizontally each, so pick the smallest
  // interval (1h, 2h, 3h, ...) that fits the plot width.
  const labelSpacing = fontSize + 2;
  const maxLabels = Math.max(1, Math.floor(plotW / labelSpacing));
  let labelStep = 1;
  while (Math.floor((count - 1) / labelStep) + 1 > maxLabels) {
    labelStep += 1;
  }
  const labels: Array<{ index: number; text: string }> = [];
  const format = (p: DataPoint) =>
    `${p.time.getHours().toString().padStart(2, "0")}:00`;
  for (let i = 0; i < count; i++) {
    if (i % labelStep === 0) {
      labels.push({ index: i, text: format(points[i]) });
    }
  }
  const labelY = height - Math.max(fontSize * 1.6, padBottom * 0.6);

  const gridCount = Math.max(2, Math.min(6, Math.round(plotH / 34)));
  const gridValues: number[] = [];
  for (let k = 1; k <= gridCount; k++) {
    gridValues.push(lo + ((hi - lo) * k) / (gridCount + 1));
  }
  const formatValue = (v: number) => Number(v.toFixed(1)).toString();
  const labelFontSize = Math.max(8, fontSize - 1);

  const strokeWidth = Math.max(1.5, Math.min(4, width / 120));
  const dotRadius = Math.max(3, Math.min(7, width / 90));

  const handleMouseMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (count < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const rel = (px - padX / width) / (plotW / width);
    const raw = Math.round(rel * (count - 1));
    const index = Math.min(count - 1, Math.max(0, raw));
    setHoverIndex(index);
    onHover?.(points[index]);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    onHover?.(null);
  };

  return (
    <div ref={containerRef} className="relative size-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Last 24 hours"
        className="text-muted-foreground absolute inset-0 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {gridValues.map((v, i) => (
          <line
            key={i}
            x1={padX}
            x2={width - padX}
            y1={y(v)}
            y2={y(v)}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        ))}
        {gridValues.map((v, i) => (
          <text
            key={`y-${i}`}
            x={padX - 6}
            y={y(v) + labelFontSize * 0.35}
            textAnchor="end"
            className="fill-current tabular-nums"
            style={{ fontSize: labelFontSize }}
          >
            {formatValue(v)}
          </text>
        ))}
        {hoverIndex !== null && (
          <g>
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={padTop}
              y2={height - padBottom}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle
              cx={x(hoverIndex)}
              cy={y(points[hoverIndex].value)}
              r={dotRadius}
              strokeWidth={strokeWidth < 3 ? 2 : strokeWidth}
              className={cn(strokeClass, "fill-background")}
            />
          </g>
        )}
        <path
          d={path}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={strokeClass}
        />
        {labels.map(({ index, text }) => (
          <text
            key={index}
            x={x(index)}
            y={labelY}
            textAnchor="middle"
            transform={`rotate(-90 ${x(index)} ${labelY})`}
            className="fill-current tabular-nums"
            style={{ fontSize }}
          >
            {text}
          </text>
        ))}
      </svg>
    </div>
  );
}

const DEFAULT_CHART_WIDTH = 320;
const DEFAULT_CHART_HEIGHT = 300;
const MIN_CHART_WIDTH = 240;
const MIN_CHART_HEIGHT = 180;

function ChartCard({
  node,
  attribute,
  pinned,
  left,
  top,
  onClose,
  onTogglePin,
}: {
  node: SiteNode;
  attribute: SeriesKey;
  pinned: boolean;
  left: number;
  top: number;
  onClose: () => void;
  onTogglePin: () => void;
}) {
  const { offset, onPointerDown, onPointerMove, endDrag } = useDragOffset();
  const [size, setSize] = useState({
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT,
  });
  const [hovered, setHovered] = useState<DataPoint | null>(null);
  const resizeRef = useRef<{
    sx: number;
    sy: number;
    w: number;
    h: number;
  } | null>(null);

  const points = useMemo(() => hourlySeries(node, attribute), [node, attribute]);
  const latest = points[points.length - 1];
  const display = hovered ?? latest;

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    resizeRef.current = {
      sx: event.clientX,
      sy: event.clientY,
      w: size.width,
      h: size.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    const next = {
      width: Math.max(MIN_CHART_WIDTH, r.w + (event.clientX - r.sx)),
      height: Math.max(MIN_CHART_HEIGHT, r.h + (event.clientY - r.sy)),
    };
    setSize((prev) =>
      prev.width === next.width && prev.height === next.height ? prev : next,
    );
  };

  const endResize = () => {
    resizeRef.current = null;
  };

  return (
    <div
      className="bg-background text-foreground absolute z-[1000] flex flex-col overflow-hidden rounded-lg border border-border shadow-2xl"
      style={{
        top,
        left,
        width: size.width,
        height: size.height,
        transform: `translate(${offset.dx}px, ${offset.dy}px)`,
      }}
    >
      <div
        className="bg-muted/70 flex cursor-grab touch-none items-center justify-between gap-2 border-b border-border px-3 py-2 select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="text-foreground flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <AttributeIcon attribute={attribute} />
          <span className="truncate">{node.name}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={pinned ? "Unpin chart" : "Pin chart"}
            aria-pressed={pinned}
            className={cn(
              "text-muted-foreground hover:text-foreground rounded-sm p-0.5 transition-colors",
              pinned && "text-foreground",
            )}
          >
            <Pin className={cn("size-4", pinned && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chart"
            className="text-muted-foreground hover:text-foreground shrink-0 rounded-sm p-0.5 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <span className="text-foreground truncate text-sm font-medium">
            {seriesLabel[attribute]}
          </span>
          <span className="text-right text-xs tabular-nums">
            <span
              className={cn(
                "block transition-colors",
                hovered
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {display.value.toFixed(3)} {seriesUnit[attribute]}
            </span>
            <span className="text-muted-foreground block text-[10px]">
              {hovered
                ? `${hovered.time
                    .getHours()
                    .toString()
                    .padStart(2, "0")}:00`
                : "latest"}
            </span>
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <HourlyChart
            points={points}
            strokeClass={SERIES_STROKE[attribute]}
            onHover={setHovered}
          />
        </div>
      </div>
      <button
        type="button"
        aria-label="Resize chart"
        className="absolute right-0 bottom-0 z-10 flex size-5 cursor-nwse-resize touch-none items-center justify-center"
        onPointerDown={startResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      >
        <span className="block h-2.5 w-2.5 border-r-2 border-b-2 border-muted-foreground/60" />
      </button>
    </div>
  );
}

function ChartDismisser({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const { map } = useMap();
  // Keep latest values for the map-click handler without re-registering it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const openRef = useRef(open);
  openRef.current = open;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!map) return;
    const handler = () => {
      if (openRef.current) onDismissRef.current();
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map]);

  return null;
}

function ChartPositioner({
  enabled,
  refreshKey,
  onUpdate,
  anchor,
  onAnchor,
}: {
  enabled: boolean;
  refreshKey: string;
  onUpdate: () => void;
  anchor?: SiteNode | null;
  onAnchor?: (point: { x: number; y: number }) => void;
}) {
  const { map } = useMap();

  useEffect(() => {
    if (!map || !enabled) return;
    const update = () => {
      onUpdate();
      if (anchor) {
        const p = map.project([anchor.lng, anchor.lat]);
        onAnchor?.({ x: p.x, y: p.y });
      }
    };
    map.on("move", update);
    map.on("zoom", update);
    window.addEventListener("resize", update);
    return () => {
      map.off("move", update);
      map.off("zoom", update);
      window.removeEventListener("resize", update);
    };
  }, [map, enabled, onUpdate, anchor, onAnchor]);

  useLayoutEffect(() => {
    if (!enabled) return;
    onUpdate();
    if (anchor) {
      const p = map?.project([anchor.lng, anchor.lat]);
      if (p) onAnchor?.({ x: p.x, y: p.y });
    }
  }, [map, enabled, refreshKey, onUpdate, anchor, onAnchor]);

  return null;
}

function NotificationDrawer({
  open,
  notifications,
  onClose,
}: {
  open: boolean;
  notifications: NodeNotification[];
  onClose: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "bg-black/40 absolute inset-0 z-40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "bg-background text-foreground absolute inset-y-0 right-0 z-50 flex w-96 max-w-full flex-col shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="bg-sidebar text-sidebar-foreground flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-sidebar-foreground/70 truncate text-xs">
              {notifications.length}{" "}
              {notifications.length === 1 ? "event" : "events"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="hover:bg-sidebar-accent text-sidebar-foreground rounded-md p-1.5 transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">
              No notifications
            </p>
          ) : (
            <ol className="p-4">
              {notifications.map((notification, index) => {
                const { date, time } = formatDetectedAt(notification.detectedAt);
                const isLast = index === notifications.length - 1;
                return (
                  <li key={notification.id} className="relative pb-5 pl-6 last:pb-0">
                    {!isLast && (
                      <span className="bg-border absolute top-5 bottom-0 left-[5px] w-px" />
                    )}
                    <span
                      className={cn(
                        "absolute top-1 left-0 size-[11px] rounded-full ring-2 ring-background",
                        statusDot(notification.status),
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {notification.nodeName}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-bold tracking-wide uppercase",
                            notification.status === "offline"
                              ? "text-red-500"
                              : notification.status === "online"
                                ? "text-green-600 dark:text-green-500"
                                : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {statusLabel(notification.status)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {notification.detail}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                        {date} · {time}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </>
  );
}

function AttributeRow({
  icon: Icon,
  label,
  active,
  onClick,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs tabular-nums transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="text-muted-foreground size-3.5 shrink-0" />
      <span className="font-medium">{label}</span>
      <span className="ml-auto flex items-center gap-1.5">{children}</span>
    </button>
  );
}

function CctvSection({
  node,
  onOpenCctv,
}: {
  node: SiteNode;
  onOpenCctv: (node: SiteNode, cctv: Cctv) => void;
}) {
  if (node.cctv.length === 0) {
    return (
      <p className="text-muted-foreground mt-2.5 flex items-center gap-1.5 text-xs">
        <VideoOff className="size-3.5 shrink-0" />
        No CCTV
      </p>
    );
  }

  return (
    <Accordion defaultValue={[] as string[]} className="mt-2">
      <AccordionItem value="cctv">
        <AccordionTrigger className="text-xs">
          <span className="flex items-center gap-1.5">
            <Video className="size-3.5" />
            View
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-1.5">
            {node.cctv.map((cctv) => (
              <Button
                key={cctv.name}
                type="button"
                size="xs"
                variant="outline"
                className="justify-start"
                onClick={() => onOpenCctv(node, cctv)}
              >
                <Video className="size-3" />
                {cctv.name}
              </Button>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function LocatorMap({
  nodes,
  selectedId,
  onSelect,
  onClearSelection,
  center,
}: LocatorMapProps) {
  const selected = nodes.find((node) => node.id === selectedId);
  const [cctvCards, setCctvCards] = useState<CctvCardData[]>([]);
  const [chartCards, setChartCards] = useState<ChartCardData[]>([]);
  const [chartPos, setChartPos] = useState({ left: 30, top: 30 });
  const [cctvPos, setCctvPos] = useState({ left: CCTV_MARGIN, top: CCTV_MARGIN });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [, setNow] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const notifications = useMemo(() => nodeNotifications(nodes), [nodes]);

  const openCctv = (node: SiteNode, cctv: Cctv) => {
    const id = `${node.id}:${cctv.name}`;
    setCctvCards((prev) =>
      prev.some((card) => card.id === id)
        ? prev
        : [...prev, { id, cctvName: cctv.name, url: cctv.url, nodeName: node.name }],
    );
  };

  const closeCctv = (id: string) => {
    setCctvCards((prev) => prev.filter((card) => card.id !== id));
  };

  const openChart = (node: SiteNode, attribute: SeriesKey) => {
    const id = `${node.id}:${attribute}`;
    setChartCards((prev) => {
      if (prev.some((card) => card.id === id)) {
        return prev.filter((card) => card.id !== id);
      }
      return [...prev, { id, nodeId: node.id, attribute, pinned: false }];
    });
  };

  const closeChart = (id: string) => {
    setChartCards((prev) => prev.filter((card) => card.id !== id));
  };

  const togglePin = (id: string) => {
    setChartCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, pinned: !card.pinned } : card,
      ),
    );
  };

  const handleClearSelection = () => {
    setChartCards((prev) => prev.filter((card) => card.pinned));
    onClearSelection();
  };

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const popupElRef = useRef<HTMLDivElement | null>(null);

  const updateChartPos = useCallback(() => {
    const popupEl = popupElRef.current;
    const overlay = overlayRef.current;
    if (!popupEl || !overlay) return;
    const popupRect = popupEl.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    setChartPos((prev) => {
      const left = popupRect.right - overlayRect.left + 15;
      const top = popupRect.top - overlayRect.top;
      if (Math.abs(prev.left - left) < 0.5 && Math.abs(prev.top - top) < 0.5) {
        return prev;
      }
      return { left, top };
    });
  }, []);

  const updateCctvPos = useCallback((point: { x: number; y: number }) => {
    setCctvPos((prev) => {
      const left = point.x - CCTV_CARD_WIDTH / 2;
      const top = point.y + 12;
      if (Math.abs(prev.left - left) < 0.5 && Math.abs(prev.top - top) < 0.5) {
        return prev;
      }
      return { left, top };
    });
  }, []);

  return (
    <div ref={overlayRef} className="relative h-full overflow-hidden">
      <SidebarTrigger className="bg-background absolute top-3 left-3 z-10 border shadow-sm md:hidden" />
      <button
        type="button"
        onClick={() => setNotificationsOpen((open) => !open)}
        aria-label={
          notificationsOpen ? "Close notifications" : "Open notifications"
        }
        className="bg-sidebar text-sidebar-foreground absolute top-[30px] right-[30px] z-20 flex size-11 items-center justify-center rounded-full border border-sidebar-border shadow-md transition-colors hover:bg-sidebar-accent"
      >
        <Bell className="size-5" />
        {notifications.length > 0 && (
          <span className="bg-red-500 absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
            {notifications.length}
          </span>
        )}
      </button>
      <SidebarTrigger className="bg-background absolute top-3 left-3 z-10 border shadow-sm md:hidden" />

      <Map center={center} zoom={7} minZoom={3} maxZoom={17}>
        <MapControls showFullscreen showCompass />
        <FlyToSelected node={selected} />
        <ChartDismisser
          open={chartCards.length > 0}
          onDismiss={handleClearSelection}
        />
        <ChartPositioner
          enabled={chartCards.length > 0 || cctvCards.length > 0}
          refreshKey={[
            ...chartCards.map((card) => card.id),
            ...cctvCards.map((card) => card.id),
          ].join(",")}
          onUpdate={updateChartPos}
          anchor={selected}
          onAnchor={updateCctvPos}
        />

        {nodes.map((node) => (
          <MapMarker
            key={node.id}
            longitude={node.lng}
            latitude={node.lat}
            onClick={() => onSelect(node.id)}
          >
            <MarkerContent>
              <StorePin
                status={deriveStatus(node)}
                active={node.id === selectedId}
              />
            </MarkerContent>
            <MarkerTooltip
              offset={24}
              className="bg-foreground text-background"
            >
              {node.name}
            </MarkerTooltip>
          </MapMarker>
        ))}

        {selected && (
          <MapPopup
            longitude={selected.lng}
            latitude={selected.lat}
            offset={26}
            closeButton
            closeOnClick={false}
            onClose={handleClearSelection}
            className="w-64 min-w-56"
            focusAfterOpen={false}
            popupRef={popupElRef}
          >
            <p className="text-foreground pr-5 pb-2.5 text-base font-medium">
              {selected.name}
            </p>
            {(() => {
              const status = deriveStatus(selected);
              return (
                <span
                  className={cn(
                    "mt-1 flex items-center gap-1.5 text-xs font-medium",
                    status === "offline" && "font-bold",
                  )}
                >
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      statusDot(status),
                    )}
                  />
                  {status === "offline" ? (
                    <>
                      <span className="text-white">offline:</span>
                      <span className="text-red-500">
                        {offlineDuration(selected.lastDataAt)}
                      </span>
                    </>
                  ) : (
                    statusLabel(status)
                  )}
                </span>
              );
            })()}

            <div className="mt-2.5 space-y-0.5">
              <AttributeRow
                icon={selected.powerSource === "commercial" ? Zap : Fuel}
                label="Power"
                active={
                  chartCards.some(
                    (card) =>
                      card.nodeId === selected.id &&
                      card.attribute === "voltage",
                  )
                }
                onClick={() => openChart(selected, "voltage")}
              >
                {selected.powerSource}
              </AttributeRow>
              <AttributeRow
                icon={Fuel}
                label="Fuel"
                active={
                  chartCards.some(
                    (card) =>
                      card.nodeId === selected.id &&
                      card.attribute === "fuelLevel",
                  )
                }
                onClick={() => openChart(selected, "fuelLevel")}
              >
                {selected.fuelLevel}%
              </AttributeRow>
              <AttributeRow
                icon={Thermometer}
                label="Temperature"
                active={
                  chartCards.some(
                    (card) =>
                      card.nodeId === selected.id &&
                      card.attribute === "temperature",
                  )
                }
                onClick={() => openChart(selected, "temperature")}
              >
                {selected.temperature.toFixed(1)} °C
              </AttributeRow>
              <AttributeRow
                icon={Droplets}
                label="Humidity"
                active={
                  chartCards.some(
                    (card) =>
                      card.nodeId === selected.id &&
                      card.attribute === "humidity",
                  )
                }
                onClick={() => openChart(selected, "humidity")}
              >
                {selected.humidity}%
              </AttributeRow>
              <AttributeRow
                icon={Snowflake}
                label="Cooling"
                active={
                  chartCards.some(
                    (card) =>
                      card.nodeId === selected.id &&
                      card.attribute === "coolingAmps",
                  )
                }
                onClick={() => openChart(selected, "coolingAmps")}
              >
                <span className="tabular-nums">{selected.coolingAmps.toFixed(3)}A</span>
                <span
                  className={cn(
                    "rounded px-1 py-0.5 text-[10px] leading-none font-semibold",
                    selected.cooling === "on"
                      ? "bg-white text-black"
                      : "bg-red-500 text-white",
                  )}
                >
                  {coolingLabel(selected.cooling)}
                </span>
              </AttributeRow>
            </div>

            <CctvSection node={selected} onOpenCctv={openCctv} />
          </MapPopup>
        )}
      </Map>

      {cctvCards.map((card, index) => (
        <CctvCard
          key={card.id}
          card={card}
          stackIndex={index}
          left={cctvPos.left}
          top={cctvPos.top}
          onClose={() => closeCctv(card.id)}
        />
      ))}

      {chartCards.map((card, index) => {
        const node = nodes.find((n) => n.id === card.nodeId);
        if (!node) return null;
        return (
          <ChartCard
            key={card.id}
            node={node}
            attribute={card.attribute}
            pinned={card.pinned}
            left={chartPos.left}
            top={chartPos.top + index * CHART_STACK_OFFSET}
            onClose={() => closeChart(card.id)}
            onTogglePin={() => togglePin(card.id)}
          />
        );
      })}

      <NotificationDrawer
        open={notificationsOpen}
        notifications={notifications}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
}