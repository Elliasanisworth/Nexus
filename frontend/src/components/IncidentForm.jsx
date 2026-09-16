import { useState } from "react";

export default function IncidentForm({ onCreated }) {
  const [form, setForm] = useState({ type: "accident", lat: "", lon: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onCreated({
        type: form.type,
        lat: parseFloat(form.lat),
        lon: parseFloat(form.lon),
        description: form.description || undefined,
      });
      setForm({ type: "accident", lat: "", lon: "", description: "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ margin: 0 }}>Create Incident</h3>
      <select name="type" value={form.type} onChange={handleChange}>
        <option value="accident">Accident</option>
        <option value="fire">Fire</option>
        <option value="medical">Medical</option>
        <option value="other">Other</option>
      </select>
      <input name="lat" placeholder="Latitude" value={form.lat} onChange={handleChange} required />
      <input name="lon" placeholder="Longitude" value={form.lon} onChange={handleChange} required />
      <input name="description" placeholder="Description (optional)" value={form.description} onChange={handleChange} />
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create Incident"}
      </button>
    </form>
  );
}
