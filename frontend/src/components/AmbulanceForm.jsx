import { useState } from "react";

export default function AmbulanceForm({ onCreated }) {
  const [form, setForm] = useState({ code: "", lat: "", lon: "", status: "available" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreated({
        code: form.code,
        lat: parseFloat(form.lat),
        lon: parseFloat(form.lon),
        status: form.status,
      });
      setForm({ code: "", lat: "", lon: "", status: "available" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ margin: 0 }}>Add Ambulance</h3>
      <input name="code" placeholder="Code (e.g. A-01)" value={form.code} onChange={handleChange} required />
      <input name="lat" placeholder="Latitude" value={form.lat} onChange={handleChange} required />
      <input name="lon" placeholder="Longitude" value={form.lon} onChange={handleChange} required />
      <select name="status" value={form.status} onChange={handleChange}>
        <option value="available">Available</option>
        <option value="busy">Busy</option>
        <option value="offline">Offline</option>
      </select>
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add Ambulance"}
      </button>
    </form>
  );
}
