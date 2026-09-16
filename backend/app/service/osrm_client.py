"""
Talks to OSRM for road distance + travel time between two points.
Uses the public OSRM demo server (http://router.project-osrm.org) — no API key needed,
but no uptime guarantee either. If it fails, callers should fall back to
straight-line distance (see recommendation_service.py).
"""

import os
import math
from dataclasses import dataclass
from typing import Optional, Any

import requests

OSRM_BASE_URL = os.getenv("OSRM_BASE_URL", "http://router.project-osrm.org")


class OSRMError(Exception):
    pass


@dataclass
class RouteResult:
    distance_m: float
    duration_seconds: float
    geometry: Optional[Any]  # GeoJSON LineString geometry, or None


def osrm_route(origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float) -> RouteResult:
    """
    origin = ambulance location, dest = incident location.
    OSRM expects "lon,lat" order (not lat,lon) — easy bug to hit, watch this.
    """
    coords = f"{origin_lon},{origin_lat};{dest_lon},{dest_lat}"
    url = f"{OSRM_BASE_URL}/route/v1/driving/{coords}"
    params = {"overview": "full", "geometries": "geojson"}

    try:
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        raise OSRMError(f"OSRM request failed: {e}")

    if data.get("code") != "Ok" or not data.get("routes"):
        raise OSRMError(f"OSRM returned no route: {data.get('code')}")

    route = data["routes"][0]
    return RouteResult(
        distance_m=route["distance"],
        duration_seconds=route["duration"],
        geometry=route.get("geometry"),
    )


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance in meters. Used only as a fallback when OSRM is unreachable."""
    R = 6371000  # earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))
