import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const client = axios.create({ baseURL: API_BASE });

export const api = {
  listAmbulances: () => client.get("/ambulances").then((r) => r.data),
  createAmbulance: (data) => client.post("/ambulances", data).then((r) => r.data),
  updateAmbulance: (id, data) => client.patch(`/ambulances/${id}`, data).then((r) => r.data),

  listIncidents: () => client.get("/incidents").then((r) => r.data),
  createIncident: (data) => client.post("/incidents", data).then((r) => r.data),
  getIncident: (id) => client.get(`/incidents/${id}`).then((r) => r.data),
  updateIncidentStatus: (id, status) =>
    client.patch(`/incidents/${id}/status`, { status }).then((r) => r.data),
  resolveIncident: (id) => client.post(`/incidents/${id}/resolve`).then((r) => r.data),

  getRecommendation: (incidentId) =>
    client.get(`/recommendation/${incidentId}`).then((r) => r.data),
  acceptRecommendation: (id) =>
    client.post(`/recommendation/${id}/accept`).then((r) => r.data),
  modifyRecommendation: (id, ambulanceId) =>
    client.post(`/recommendation/${id}/modify`, { ambulance_id: ambulanceId }).then((r) => r.data),
  rejectRecommendation: (id) =>
    client.post(`/recommendation/${id}/reject`).then((r) => r.data),

  listHospitals: () => client.get("/hospitals").then((r) => r.data),
  requestHospitalTransport: (incidentId, ambulanceId) =>
    client
      .post(`/incidents/${incidentId}/hospital-transport`, { ambulance_id: ambulanceId })
      .then((r) => r.data),

  // Method 2 (address/place search -> lat/lon): hits OpenStreetMap's free
  // Nominatim geocoder directly from the browser. No API key, same OSM
  // ecosystem as the Leaflet tiles + OSRM routing already in use.
  // Production note: real deployment should proxy this through the backend
  // (rate limits + usage policy on the public instance) — called directly
  // here only because this is a prototype.
  geocodeSearch: (query) =>
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`
    ).then((r) => r.json()),
};
