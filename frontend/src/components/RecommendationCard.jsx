import { useState } from "react";

export default function RecommendationCard({ recommendation, ambulances, onAccept, onModify, onReject, onResolve }) {
  const [modifyMode, setModifyMode] = useState(false);
  const [chosenAmbulanceId, setChosenAmbulanceId] = useState("");

  if (!recommendation) {
    return (
      <div style={cardStyle}>
        <h3 style={{ margin: 0 }}>NEXUS Recommendation</h3>
        <p style={{ opacity: 0.6 }}>Create an incident to see a recommendation.</p>
      </div>
    );
  }

  if (recommendation.error) {
    return (
      <div style={cardStyle}>
        <h3 style={{ margin: 0 }}>NEXUS Recommendation</h3>
        <p style={{ color: "#ef4444" }}>{recommendation.error}</p>
      </div>
    );
  }

  const ambulance = ambulances.find((a) => a.id === recommendation.ambulance_id);
  const etaMinutes = Math.round(recommendation.eta_seconds / 60);
  const distanceKm = (recommendation.distance_m / 1000).toFixed(1);
  const isDecided = recommendation.status !== "pending";
  // "Dispatched" covers both accept and modify — both produce an active
  // Assignment that can still be resolved to close the loop.
  const isDispatched = recommendation.status === "accepted" || recommendation.status === "modified";
  const isResolved = recommendation.status === "resolved";

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: 0 }}>NEXUS Recommendation</h3>
      <p>🚑 Ambulance: <strong>{ambulance?.code || "unknown"}</strong></p>
      <p>Road Distance: {distanceKm} km</p>
      <p>Estimated Arrival: {etaMinutes} min</p>
      <p style={{ opacity: 0.6, fontSize: 13 }}>
        Reason: fastest estimated arrival among available ambulances
        {recommendation.route_geometry === null ? " (fallback estimate — OSRM unavailable)" : ""}
      </p>
      <p style={{ fontSize: 13 }}>Status: <strong>{recommendation.status}</strong></p>

      {!isDecided && !modifyMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={onAccept}>Accept</button>
          <button onClick={() => setModifyMode(true)}>Modify</button>
          <button onClick={onReject}>Reject</button>
        </div>
      )}

      {!isDecided && modifyMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <select value={chosenAmbulanceId} onChange={(e) => setChosenAmbulanceId(e.target.value)}>
            <option value="">Pick ambulance</option>
            {ambulances
              .filter((a) => a.status === "available")
              .map((a) => (
                <option key={a.id} value={a.id}>{a.code}</option>
              ))}
          </select>
          <button disabled={!chosenAmbulanceId} onClick={() => onModify(chosenAmbulanceId)}>
            Confirm
          </button>
          <button onClick={() => setModifyMode(false)}>Cancel</button>
        </div>
      )}

      {isDispatched && (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            🚑 {ambulance?.code || "Ambulance"} is en route.
          </p>
          <button onClick={onResolve}>Mark Resolved</button>
        </div>
      )}

      {isResolved && (
        <p style={{ fontSize: 13, color: "#22c55e", marginTop: 8 }}>
          ✅ Incident resolved — ambulance is available again.
        </p>
      )}
    </div>
  );
}

const cardStyle = {
  background: "#1a1d23",
  border: "1px solid #2a2e37",
  borderRadius: 8,
  padding: 16,
};
