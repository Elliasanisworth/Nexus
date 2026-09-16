import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const client = axios.create({ baseURL: API_BASE });

export const api = {
  listAmbulances: () => client.get("/ambulances").then((r) => r.data),
  createAmbulance: (data) => client.post("/ambulances", data).then((r) => r.data),
  updateAmbulance: (id, data) => client.patch(`/ambulances/${id}`, data).then((r) => r.data),

  listIncidents: () => client.get("/incidents").then((r) => r.data),
  createIncident: (data) => client.post("/incidents", data).then((r) => r.data),

  getRecommendation: (incidentId) =>
    client.get(`/recommendation/${incidentId}`).then((r) => r.data),
  acceptRecommendation: (id) =>
    client.post(`/recommendation/${id}/accept`).then((r) => r.data),
  modifyRecommendation: (id, ambulanceId) =>
    client.post(`/recommendation/${id}/modify`, { ambulance_id: ambulanceId }).then((r) => r.data),
  rejectRecommendation: (id) =>
    client.post(`/recommendation/${id}/reject`).then((r) => r.data),
};
