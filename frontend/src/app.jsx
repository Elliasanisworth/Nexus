import { useEffect, useState } from "react";
import { api } from "./api";
import Map from "./components/Map";
import AmbulanceForm from "./components/AmbulanceForm";
import AmbulanceList from "./components/AmbulanceList";
import IncidentForm from "./components/IncidentForm";
import RecommendationCard from "./components/RecommendationCard";

export default function App() {
  const [ambulances, setAmbulances] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [latestIncident, setLatestIncident] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

  const refreshAmbulances = () => api.listAmbulances().then(setAmbulances);
  const refreshIncidents = () => api.listIncidents().then(setIncidents);

  useEffect(() => {
    refreshAmbulances();
    refreshIncidents();
  }, []);

  const handleAddAmbulance = async (data) => {
    await api.createAmbulance(data);
    await refreshAmbulances();
  };

  const handleCreateIncident = async (data) => {
    const incident = await api.createIncident(data);
    setLatestIncident(incident);
    await refreshIncidents();

    // step 3-6 of the flow: ask backend for the recommendation right away
    try {
      const rec = await api.getRecommendation(incident.id);
      setRecommendation(rec);
    } catch (err) {
      setRecommendation({ error: "No ambulance available for this incident." });
    }
  };

  const handleAccept = async () => {
    const updated = await api.acceptRecommendation(recommendation.id);
    setRecommendation(updated);
    await refreshAmbulances();
  };

  const handleModify = async (ambulanceId) => {
    const updated = await api.modifyRecommendation(recommendation.id, ambulanceId);
    setRecommendation(updated);
    await refreshAmbulances();
  };

  const handleReject = async () => {
    const updated = await api.rejectRecommendation(recommendation.id);
    setRecommendation(updated);
  };

  const mapCenter = latestIncident ? [latestIncident.lat, latestIncident.lon] : undefined;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 320px", height: "100vh" }}>
      <div style={{ padding: 16, overflowY: "auto", borderRight: "1px solid #2a2e37" }}>
        <h2 style={{ marginTop: 0 }}>NEXUS</h2>
        <p style={{ opacity: 0.6, fontSize: 13, marginTop: -8 }}>Ambulance Dispatch Prototype</p>
        <AmbulanceForm onCreated={handleAddAmbulance} />
        <hr style={{ margin: "16px 0", borderColor: "#2a2e37" }} />
        <AmbulanceList ambulances={ambulances} />
      </div>

      <div>
        <Map
          ambulances={ambulances}
          incidents={incidents}
          routeGeometry={recommendation?.route_geometry}
          center={mapCenter}
        />
      </div>

      <div style={{ padding: 16, overflowY: "auto", borderLeft: "1px solid #2a2e37", display: "flex", flexDirection: "column", gap: 16 }}>
        <IncidentForm onCreated={handleCreateIncident} />
        <RecommendationCard
          recommendation={recommendation}
          ambulances={ambulances}
          onAccept={handleAccept}
          onModify={handleModify}
          onReject={handleReject}
        />
      </div>
    </div>
  );
}
