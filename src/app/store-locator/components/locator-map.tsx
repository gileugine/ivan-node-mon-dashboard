"use client";

import Hls from "hls.js";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Fuel, MapPin, Thermometer, Video, VideoOff, X, Zap } from "lucide-react";

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
  powerLabel,
  statusDot,
  statusLabel,
  type Cctv,
  type Node as SiteNode,
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

const CCTV_MARGIN = 30;

const PIN_COLOR: Record<SiteStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  attention: "bg-orange-500",
};

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

function StorePin({ status, active }: { status: SiteStatus; active: boolean }) {
  return (
    <div className="relative">
      {status === "attention" && (
        <span
          aria-hidden
          className="bg-orange-500/50 pointer-events-none absolute inset-0 animate-ping rounded-full"
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
        <MapPin className={cn(active ? "size-4.5" : "size-3.5")} />
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
}: {
  card: CctvCardData;
  stackIndex: number;
  onClose: () => void;
}) {
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

  return (
    <div
      className="bg-background text-foreground absolute z-[1000] w-80 overflow-hidden rounded-lg border border-border shadow-2xl"
      style={{
        top: CCTV_MARGIN + stackIndex * CCTV_MARGIN,
        right: CCTV_MARGIN,
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

  return (
    <div className="relative h-full">
      <SidebarTrigger className="bg-background absolute top-3 left-3 z-10 border shadow-sm md:hidden" />

      <Map center={center} zoom={7} minZoom={3} maxZoom={17}>
        <MapControls showFullscreen showCompass />
        <FlyToSelected node={selected} />

        {nodes.map((node) => (
          <MapMarker
            key={node.id}
            longitude={node.lng}
            latitude={node.lat}
            onClick={() => onSelect(node.id)}
          >
            <MarkerContent>
              <StorePin
                status={node.status}
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
            onClose={onClearSelection}
            className="w-64 min-w-56"
            focusAfterOpen={false}
          >
            <p className="text-popover-foreground pr-5 font-medium">
              {selected.name}
            </p>
            <span className="mt-1 flex items-center gap-1.5 text-xs font-medium">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  statusDot(selected.status),
                )}
              />
              {statusLabel(selected.status)}
            </span>

            <div className="text-muted-foreground mt-2.5 space-y-1.5 text-xs tabular-nums">
              <p className="flex items-center gap-1.5">
                {selected.powerSource === "commercial" ? (
                  <Zap className="size-3.5 shrink-0" />
                ) : (
                  <Fuel className="size-3.5 shrink-0" />
                )}
                {powerLabel(selected.powerSource)} ·{" "}
                {selected.voltage} Vac
              </p>
              <p className="flex items-center gap-1.5">
                <Fuel className="size-3.5 shrink-0" />
                Fuel {selected.fuelLevel}%
              </p>
              <p className="flex items-center gap-1.5">
                <Thermometer className="size-3.5 shrink-0" />
                {selected.temperature.toFixed(1)} °C · Humidity{" "}
                {selected.humidity}%
              </p>
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
          onClose={() => closeCctv(card.id)}
        />
      ))}
    </div>
  );
}