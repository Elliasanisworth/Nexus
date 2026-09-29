import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { colors } from "./../theme";

const ambulanceIcon = (status) =>
  L.divIcon({
    className: "",
    html: `<div style="
      background:${status === "available" ? colors.success : status === "busy" ? colors.warning : colors.textMuted};
      width:16px;height:16px;border-radius:50%;border:2px solid white;
      box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const incidentIcon = L.divIcon({
  className: "",
  html: `<div style="
    background:${colors.danger};width:18px;height:18px;border-radius:50%;
    border:2px solid white;box-shadow:0 0 6px rgba(239,68,68,0.8);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const hospitalIcon = L.divIcon({
  className: "",
  html: `<div style="
    position:relative;width:18px;height:18px;border-radius:50%;
    background:${colors.info};border:2px solid white;
    box-shadow:0 0 6px ${colors.info}99;">
    <div style="position:absolute;top:3px;left:7px;width:4px;height:10px;background:white;border-radius:1px;"></div>
    <div style="position:absolute;top:7px;left:3px;width:10px;height:4px;background:white;border-radius:1px;"></div>
  </div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// En-route marker: label shows unit code + leg + live countdown.
const enRouteIcon = (label, legColor) =>
  L.divIcon({
    className: "",
    html: `<div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${legColor};
        border:2px solid white;box-shadow:0 0 8px ${legColor}99;"></div>
      <div style="position:absolute;top:22px;left:50%;transform:translateX(-50%);
        background:#0a0c10;color:#e7e9ec;font-size:11px;padding:2px 6px;
        border-radius:4px;white-space:nowrap;border:1px solid #242a35;">${label}</div>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

function formatCountdown(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

// Walks a polyline proportionally by point-index fraction. Simplified
// (not distance-weighted along the geometry) — fine for a demo visual.
function interpolateAlongPath(positions, fraction) {
  if (!positions || positions.length === 0) return null;
  if (positions.length === 1) return positions[0];
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const scaled = clamped * (positions.length - 1);
  const idx = Math.floor(scaled);
  const t = scaled - idx;
  const a = positions[idx];
  const b = positions[Math.min(idx + 1, positions.length - 1)];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function ClickCapture({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (active) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// One animated leg for one dispatch. Separate component so each dispatch's
// countdown/interpolation runs independently and fires onArrive exactly
// once per leg (keyed by startedAt, so a new leg on the same dispatch fires
// again).
function DispatchMarker({ dispatch, onArrive }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const firedRef = useRef(null);

  useEffect(() => {
    const tick = () => setElapsedSeconds((Date.now() - dispatch.startedAt) / 1000);
    tick();
    const interval = setInterval(tick, 400);
    return () => clearInterval(interval);
  }, [dispatch.startedAt]);

  const positions = useMemo(() => {
    const roadShape = dispatch.routeGeometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];
    if (roadShape.length > 1) {
      return [dispatch.originPos, ...roadShape, dispatch.destPos];
    }
    return [dispatch.originPos, dispatch.destPos];
  }, [dispatch.routeGeometry, dispatch.originPos, dispatch.destPos]);

  const fraction = dispatch.moving ? elapsedSeconds / dispatch.etaSeconds : 1;
  const remaining = dispatch.moving ? dispatch.etaSeconds - elapsedSeconds : 0;
  const position = interpolateAlongPath(positions, fraction) || dispatch.destPos;

  useEffect(() => {
    if (dispatch.moving && remaining <= 0 && firedRef.current !== dispatch.startedAt) {
      firedRef.current = dispatch.startedAt;
      onArrive(dispatch.id);
    }
  }, [remaining, dispatch.moving, dispatch.startedAt, dispatch.id, onArrive]);

  const legColor = dispatch.leg === "to_hospital" ? colors.info : colors.accent;
  const label = dispatch.moving
    ? `${dispatch.ambulanceCode} · ${formatCountdown(remaining)}`
    : `${dispatch.ambulanceCode} · arrived`;

  return (
    <>
      <Polyline positions={positions} pathOptions={{ color: legColor, weight: 4, dashArray: dispatch.moving ? "6 6" : null }} />
      <Marker position={position} icon={enRouteIcon(label, legColor)}>
        <Popup>
          🚑 {dispatch.ambulanceCode} — {dispatch.legLabel}
          {dispatch.moving ? ` (ETA ${formatCountdown(remaining)})` : " (arrived, awaiting resolution)"}
        </Popup>
      </Marker>
    </>
  );
} 
export default function Map({
  ambulances,
  incidents,
  hospitals = [],
  routeGeometry,
  center,
  pickMode,
  onPickLocation,
  dispatches = [], // [{ id, ambulanceCode, originPos, destPos, etaSeconds, routeGeometry, startedAt, leg, legLabel, moving, ambulanceId }]
  onDispatchArrive,
}) {
  const mapCenter = center || [25.4358, 81.8463]; // default: Prayagraj

  const routePositions = routeGeometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];
  const dispatchedAmbulanceIds = new Set(dispatches.map((d) => d.ambulanceId));

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      style={{ height: "100%", width: "100%", cursor: pickMode ? "crosshair" : "" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickCapture active={!!pickMode} onPick={onPickLocation} />

      {ambulances.map((amb) => {
        // Bug fix: previously the parked marker reappeared the instant the
        // countdown hit zero. Now it stays hidden for the ENTIRE dispatch
        // lifetime (moving or arrived-and-waiting) — only reappears once the
        // incident is actually resolved and the dispatch entry is cleared.
        if (dispatchedAmbulanceIds.has(amb.id)) return null;
        return (
          <Marker key={amb.id} position={[amb.lat, amb.lon]} icon={ambulanceIcon(amb.status)}>
            <Popup>
              🚑 {amb.code} — {amb.status}
            </Popup>
          </Marker>
        );
      })}

      {incidents.map((inc) => (
        <Marker key={inc.id} position={[inc.lat, inc.lon]} icon={incidentIcon}>
          <Popup>
            {inc.type} — {inc.description || "no description"}
          </Popup>
        </Marker>
      ))}

      {hospitals.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lon]} icon={hospitalIcon}>
          <Popup>🏥 {h.name}</Popup>
        </Marker>
      ))}

      {routePositions.length > 0 && (
        <Polyline positions={routePositions} pathOptions={{ color: colors.accent, weight: 4 }} />
      )}

      {dispatches.map((d) => (
        <DispatchMarker key={d.id} dispatch={d} onArrive={onDispatchArrive} />
      ))}
    </MapContainer>
  );
}
