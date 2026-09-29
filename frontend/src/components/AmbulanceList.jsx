import { colors, badgeStyle, monoStyle } from "../theme";

export default function AmbulanceList({ ambulances }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: colors.textMuted, margin: "0 0 10px" }}>
        Fleet
      </div>
      {ambulances.length === 0 && <p style={{ opacity: 0.5, fontSize: 13 }}>No units registered.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {ambulances.map((amb) => (
          <li
            key={amb.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 10px",
              background: colors.panelAlt,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
            }}
          >
            <span style={{ ...monoStyle, fontSize: 13 }}>{amb.code}</span>
            <span style={badgeStyle(amb.status === "available" ? "resolved" : amb.status === "busy" ? "pending" : "active")}>
              {amb.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
