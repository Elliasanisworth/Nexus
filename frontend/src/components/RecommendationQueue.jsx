import { useState } from "react";
import { colors, panelStyle, sectionTitleStyle, badgeStyle, buttonStyle, primaryButtonStyle, dangerButtonStyle, monoStyle } from "../theme";

function shortId(id) {
  return id ? id.slice(0, 8) : "—";
}

function DecisionButtons({ entry, ambulances, onAccept, onModify, onReject }) {
  const [modifyMode, setModifyMode] = useState(false);
  const [chosenAmbulanceId, setChosenAmbulanceId] = useState("");

  if (modifyMode) {
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={chosenAmbulanceId}
          onChange={(e) => setChosenAmbulanceId(e.target.value)}
          style={{ background: colors.panelAlt, border: `1px solid ${colors.border}`, color: colors.text, borderRadius: 4, padding: "6px 8px" }}
        >
          <option value="">Select unit</option>
          {ambulances.filter((a) => a.status === "available").map((a) => (
            <option key={a.id} value={a.id}>{a.code}</option>
          ))}
        </select>
        <button style={primaryButtonStyle} disabled={!chosenAmbulanceId} onClick={() => onModify(chosenAmbulanceId)}>
          Confirm
        </button>
        <button style={buttonStyle} onClick={() => setModifyMode(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <button style={primaryButtonStyle} onClick={onAccept}>Accept</button>
      <button style={buttonStyle} onClick={() => setModifyMode(true)}>Modify</button>
      <button style={dangerButtonStyle} onClick={onReject}>Reject</button>
    </div>
  );
}

function EntryRow({ entry, ambulances, primary, onAccept, onModify, onReject, onResolve }) {
  const { incident, recommendation } = entry;
  const status = recommendation?.status;
  const ambulance = recommendation ? ambulances.find((a) => a.id === recommendation.ambulance_id) : null;
  const isError = status === "error";
  const isPending = status === "pending";
  const isDispatched = status === "accepted" || status === "modified";
  const isResolved = status === "resolved";

  return (
    <div
      style={{
        ...panelStyle,
        padding: primary ? 18 : 12,
        border: primary ? `1px solid ${colors.accent}` : panelStyle.border,
        marginBottom: primary ? 0 : 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: primary ? 14 : 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {incident.type}
          </div>
          <div style={{ ...monoStyle, fontSize: 11, color: colors.textMuted }}>
            #{shortId(incident.id)}{incident.description ? ` — ${incident.description}` : ""}
          </div>
        </div>
        <span style={badgeStyle(status || "pending")}>{isError ? "no unit" : status}</span>
      </div>

      {!isError && recommendation && (
        <div style={{ marginTop: primary ? 12 : 8, fontSize: primary ? 13 : 12 }}>
          <div>
            Unit <strong>{ambulance?.code || "—"}</strong> · {(recommendation.distance_m / 1000).toFixed(1)} km ·{" "}
            {Math.round(recommendation.eta_seconds / 60)} min ETA
            {recommendation.route_geometry === null ? " (fallback estimate)" : ""}
          </div>
        </div>
      )}

      {isError && (
        <div style={{ marginTop: 8, fontSize: 12, color: colors.danger }}>
          No available unit could be matched to this incident.
        </div>
      )}

      {isPending && (
        <DecisionButtons
          entry={entry}
          ambulances={ambulances}
          onAccept={() => onAccept(entry)}
          onModify={(ambId) => onModify(entry, ambId)}
          onReject={() => onReject(entry)}
        />
      )}

      {isDispatched && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: colors.textMuted }}>Unit en route — tracked on map</span>
          <button style={buttonStyle} onClick={() => onResolve(entry)}>Mark Resolved</button>
        </div>
      )}

      {isResolved && (
        <div style={{ marginTop: 8, fontSize: 12, color: colors.success }}>
          Incident resolved — unit released back to available pool.
        </div>
      )}
    </div>
  );
}

export default function RecommendationQueue({ queue, ambulances, onAccept, onModify, onReject, onResolve }) {
  const primaryEntry = queue.find((e) => e.recommendation?.status === "pending");
  const historyEntries = queue.filter((e) => e !== primaryEntry).slice().reverse();

  return (
    <div>
      <div style={sectionTitleStyle}>Decision Required</div>
      {primaryEntry ? (
        <EntryRow
          entry={primaryEntry}
          ambulances={ambulances}
          primary
          onAccept={onAccept}
          onModify={onModify}
          onReject={onReject}
          onResolve={onResolve}
        />
      ) : (
        <div style={{ ...panelStyle, color: colors.textMuted, fontSize: 13 }}>
          No pending decision. Create an incident to generate a recommendation.
        </div>
      )}

      {historyEntries.length > 0 && (
        <>
          <div style={{ ...sectionTitleStyle, marginTop: 20 }}>Queue / History</div>
          {historyEntries.map((entry) => (
            <EntryRow
              key={entry.incident.id}
              entry={entry}
              ambulances={ambulances}
              onAccept={onAccept}
              onModify={onModify}
              onReject={onReject}
              onResolve={onResolve}
            />
          ))}
        </>
      )}
    </div>
  );
}
