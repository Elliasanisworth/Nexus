const statusColor = { available: "#22c55e", busy: "#f59e0b", offline: "#6b7280" };

export default function AmbulanceList({ ambulances }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 8px" }}>Ambulances</h3>
      {ambulances.length === 0 && <p style={{ opacity: 0.6 }}>None added yet.</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {ambulances.map((amb) => (
          <li key={amb.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span>🚑 {amb.code}</span>
            <span style={{ color: statusColor[amb.status] || "#e6e6e6" }}>{amb.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
