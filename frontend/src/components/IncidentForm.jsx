import { useEffect, useState } from "react";
import { api } from "../api";
import { colors, sectionTitleStyle, inputStyle, buttonStyle, primaryButtonStyle, dangerButtonStyle } from "../theme";

export default function IncidentForm({ onCreated, pickMode, pickedLocation, onTogglePickMode }) {
  const [form, setForm] = useState({ type: "accident", lat: "", lon: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const isPicking = pickMode === "incident";
  useEffect(() => {
    if (isPicking && pickedLocation) {
      setForm((f) => ({ ...f, lat: pickedLocation.lat.toFixed(6), lon: pickedLocation.lon.toFixed(6) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedLocation]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      setSearchResults(await api.geocodeSearch(searchQuery));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pickSearchResult = (result) => {
    setForm((f) => ({ ...f, lat: parseFloat(result.lat).toFixed(6), lon: parseFloat(result.lon).toFixed(6) }));
    setSearchResults([]);
    setSearchQuery(result.display_name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreated({ type: form.type, lat: parseFloat(form.lat), lon: parseFloat(form.lon), description: form.description || undefined });
      setForm({ type: "accident", lat: "", lon: "", description: "" });
      setSearchQuery("");
      if (isPicking) onTogglePickMode(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={sectionTitleStyle}>Report Incident</div>
      <select style={inputStyle} name="type" value={form.type} onChange={handleChange}>
        <option value="accident">Accident</option>
        <option value="fire">Fire</option>
        <option value="medical">Medical</option>
        <option value="other">Other</option>
      </select>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Search location"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="button" style={buttonStyle} onClick={handleSearch} disabled={searching}>
          {searching ? "…" : "Search"}
        </button>
      </div>
      {searchResults.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, border: `1px solid ${colors.border}`, borderRadius: 4, overflow: "hidden" }}>
          {searchResults.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => pickSearchResult(r)}
                style={{ width: "100%", textAlign: "left", background: colors.panelAlt, color: colors.text, border: "none", padding: "6px 8px", fontSize: 12, cursor: "pointer" }}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onTogglePickMode(isPicking ? null : "incident")}
        style={isPicking ? dangerButtonStyle : buttonStyle}
      >
        {isPicking ? "Click the map to place incident…" : "Pick location on map"}
      </button>

      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} name="lat" placeholder="Latitude" value={form.lat} onChange={handleChange} required />
        <input style={{ ...inputStyle, flex: 1 }} name="lon" placeholder="Longitude" value={form.lon} onChange={handleChange} required />
      </div>
      <input style={inputStyle} name="description" placeholder="Description (optional)" value={form.description} onChange={handleChange} />
      <button type="submit" style={primaryButtonStyle} disabled={submitting}>
        {submitting ? "Creating…" : "Report Incident"}
      </button>
    </form>
  );
}
