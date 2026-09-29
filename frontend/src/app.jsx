import { useEffect, useState } from "react";
import { api } from "./api";
import Map from "./components/Map";
import AmbulanceForm from "./components/AmbulanceForm";
import AmbulanceList from "./components/AmbulanceList";
import IncidentForm from "./components/IncidentForm";
import RecommendationQueue from "./components/RecommendationQueue";
import { colors } from "./theme";

export default function App() {
  const [ambulances, setAmbulances] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  // Each entry: { incident, recommendation }. recommendation.status drives
  // everything: "pending" | "accepted" | "modified" | "rejected" | "resolved" | "error".
  // The primary (currently actionable) entry is always derived — the first
  // one still "pending" — never stored as separate index state, so deciding
  // on one automatically surfaces the next pending entry without any manual
  // "advance" bookkeeping.
  const [queue, setQueue] = useState([]);

  // Each entry: { id, ambulanceId, ambulanceCode, leg, legLabel, moving,
  // originPos, destPos, etaSeconds, routeGeometry, startedAt, hospital? }
  // id === incident id, so at most one active dispatch per incident.
  const [dispatches, setDispatches] = useState([]);

  const [pickMode, setPickMode] = useState(null); // "ambulance" | "incident" | null
  const [pickedLocation, setPickedLocation] = useState(null);
  const [focusIncidentId, setFocusIncidentId] = useState(null);

  const refreshAmbulances = () => api.listAmbulances().then(setAmbulances);
  const refreshIncidents = () => api.listIncidents().then(setIncidents);

  useEffect(() => {
    refreshAmbulances();
    refreshIncidents();
    api.listHospitals().then(setHospitals).catch(() => setHospitals([]));
  }, []);

  const updateQueueEntry = (incidentId, patch) => {
    setQueue((q) => q.map((e) => (e.incident.id === incidentId ? { ...e, recommendation: { ...e.recommendation, ...patch } } : e)));
  };

  const handlePickLocation = (lat, lon) => {
    if (!pickMode) return;
    setPickedLocation({ lat, lon });
  };

  const handleAddAmbulance = async (data) => {
    await api.createAmbulance(data);
    await refreshAmbulances();
  };

  const handleCreateIncident = async (data) => {
    const incident = await api.createIncident(data);
    setFocusIncidentId(incident.id);
    await refreshIncidents();

    try {
      const rec = await api.getRecommendation(incident.id);
      setQueue((q) => [...q, { incident, recommendation: rec }]);
    } catch (err) {
      setQueue((q) => [...q, { incident, recommendation: { status: "error" } }]);
    }
  };

  const startDispatch = (incident, ambulance, eta_seconds, route_geometry) => {
    setDispatches((d) => [
      ...d.filter((x) => x.id !== incident.id),
      {
        id: incident.id,
        ambulanceId: ambulance.id,
        ambulanceCode: ambulance.code,
        leg: "to_incident",
        legLabel: "En route to incident",
        moving: true,
        originPos: [ambulance.lat, ambulance.lon],
        destPos: [incident.lat, incident.lon],
        etaSeconds: eta_seconds,
        routeGeometry: route_geometry,
        startedAt: Date.now(),
      },
    ]);
  };

  const handleAccept = async (entry) => {
    const updated = await api.acceptRecommendation(entry.recommendation.id);
    const ambulance = ambulances.find((a) => a.id === updated.ambulance_id);
    updateQueueEntry(entry.incident.id, updated);
    await refreshAmbulances();
    if (ambulance) startDispatch(entry.incident, ambulance, updated.eta_seconds, updated.route_geometry);
  };

  const handleModify = async (entry, ambulanceId) => {
    const updated = await api.modifyRecommendation(entry.recommendation.id, ambulanceId);
    const ambulance = ambulances.find((a) => a.id === ambulanceId);
    updateQueueEntry(entry.incident.id, updated);
    await refreshAmbulances();
    if (ambulance) startDispatch(entry.incident, ambulance, updated.eta_seconds, updated.route_geometry);
  };

  const handleReject = async (entry) => {
    const updated = await api.rejectRecommendation(entry.recommendation.id);
    updateQueueEntry(entry.incident.id, updated);
  };

  // Fires once per leg, when a dispatch marker's countdown reaches zero.
  const handleDispatchArrive = async (incidentId) => {
    const dispatch = dispatches.find((d) => d.id === incidentId);
    if (!dispatch) return;

        if (dispatch.leg === "to_incident") {
      try {
        const transport = await api.requestHospitalTransport(incidentId, dispatch.ambulanceId);
        setDispatches((ds) =>
          ds.map((d) =>
            d.id === incidentId
              ? {
                  ...d,
                  leg: "to_hospital",
                  legLabel: "Transporting to hospital",
                  moving: true,
                  originPos: d.destPos,
                  destPos: [transport.hospital_lat, transport.hospital_lon],
                  etaSeconds: transport.eta_seconds,
                  routeGeometry: transport.route_geometry,
                  startedAt: Date.now(),
                  hospital: { id: transport.hospital_id, name: transport.hospital_name, lat: transport.hospital_lat, lon: transport.hospital_lon },
                }
              : d
          )
        );
      } catch (err) {
        console.error("hospital-transport lookup failed:", err);
        setDispatches((ds) =>
          ds.map((d) => (d.id === incidentId ? { ...d, moving: false, legLabel: "Arrived at incident" } : d))
        );
      }
    } else if (dispatch.leg === "to_hospital") {
      setDispatches((ds) =>
        ds.map((d) => (d.id === incidentId ? { ...d, moving: false, legLabel: "Arrived at hospital" } : d))
      );
    }
  };

  const handleResolve = async (entry) => {
    const incidentId = entry.incident.id;
    await api.resolveIncident(incidentId);

    const dispatch = dispatches.find((d) => d.id === incidentId);
    // If the unit made it to the hospital, reflect that as its new parked
    // location once it's freed up again — otherwise leave its location as-is.
    if (dispatch?.leg === "to_hospital" && dispatch.hospital) {
      await api.updateAmbulance(dispatch.ambulanceId, { lat: dispatch.hospital.lat, lon: dispatch.hospital.lon });
    }

    updateQueueEntry(incidentId, { status: "resolved" });
    setDispatches((ds) => ds.filter((d) => d.id !== incidentId)); // the only point the marker resets
    await refreshAmbulances();
    await refreshIncidents();
  };

  const focusIncident = incidents.find((i) => i.id === focusIncidentId);
  const mapCenter = focusIncident ? [focusIncident.lat, focusIncident.lon] : undefined;

  const availableCount = ambulances.filter((a) => a.status === "available").length;
  const activeIncidentCount = queue.filter((e) => !["resolved", "rejected", "error"].includes(e.recommendation?.status)).length;
  const enRouteCount = dispatches.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: colors.bg, color: colors.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.panel,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>NEXUS</span>
          <span style={{ fontSize: 12, color: colors.textMuted }}>Emergency Dispatch Console — Prototype</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
          <StatBlock label="Active Incidents" value={activeIncidentCount} />
          <StatBlock label="Units Available" value={`${availableCount} / ${ambulances.length}`} />
          <StatBlock label="En Route" value={enRouteCount} accent={colors.accent} />
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 360px", flex: 1, minHeight: 0 }}>
        <div style={{ padding: 16, overflowY: "auto", borderRight: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <AmbulanceForm
            onCreated={handleAddAmbulance}
            pickMode={pickMode}
            pickedLocation={pickMode === "ambulance" ? pickedLocation : null}
            onTogglePickMode={setPickMode}
          />
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
            <AmbulanceList ambulances={ambulances} />
          </div>
        </div>

        <div>
          <Map
            ambulances={ambulances}
            incidents={incidents}
            hospitals={hospitals}
            center={mapCenter}
            pickMode={pickMode}
            onPickLocation={handlePickLocation}
            dispatches={dispatches}
            onDispatchArrive={handleDispatchArrive}
          />
        </div>

        <div style={{ padding: 16, overflowY: "auto", borderLeft: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: 16 }}>
          <IncidentForm
            onCreated={handleCreateIncident}
            pickMode={pickMode}
            pickedLocation={pickMode === "incident" ? pickedLocation : null}
            onTogglePickMode={setPickMode}
          />
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
            <RecommendationQueue
              queue={queue}
              ambulances={ambulances}
              onAccept={handleAccept}
              onModify={handleModify}
              onReject={handleReject}
              onResolve={handleResolve}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, accent }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent || colors.text }}>{value}</div>
      <div style={{ fontSize: 10, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    </div>
  );
}
