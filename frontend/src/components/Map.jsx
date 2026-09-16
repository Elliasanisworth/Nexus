import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

// Leaflet's default marker icons don't load correctly with bundlers unless
// pointed at the CDN explicitly. Two divIcon styles: ambulance vs incident.
const ambulanceIcon = (status) =>
  L.divIcon({
    className: "",
    html: `<div style="
      background:${status === "available" ? "#22c55e" : status === "busy" ? "#f59e0b" : "#6b7280"};
      width:16px;height:16px;border-radius:50%;border:2px solid white;
      box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const incidentIcon = L.divIcon({
  className: "",
  html: `<div style="
    background:#ef4444;width:18px;height:18px;border-radius:50%;
    border:2px solid white;box-shadow:0 0 6px rgba(239,68,68,0.8);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function Map({ ambulances, incidents, routeGeometry, center }) {
  const mapCenter = center || [25.4358, 81.8463]; // default: Prayagraj, matches original example coords

  // route_geometry from OSRM is GeoJSON {type: "LineString", coordinates: [[lon,lat], ...]}
  // Leaflet Polyline wants [lat, lon] pairs — flip them.
  const routePositions = routeGeometry?.coordinates?.map(([lon, lat]) => [lat, lon]) || [];

  return (
    <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {ambulances.map((amb) => (
        <Marker key={amb.id} position={[amb.lat, amb.lon]} icon={ambulanceIcon(amb.status)}>
          <Popup>
            🚑 {amb.code} — {amb.status}
          </Popup>
        </Marker>
      ))}

      {incidents.map((inc) => (
        <Marker key={inc.id} position={[inc.lat, inc.lon]} icon={incidentIcon}>
          <Popup>
            {inc.type} — {inc.description || "no description"}
          </Popup>
        </Marker>
      ))}

      {routePositions.length > 0 && (
        <Polyline positions={routePositions} pathOptions={{ color: "#3b82f6", weight: 4 }} />
      )}
    </MapContainer>
  );
}
