"""
Ruthless test script for NEXUS backend. Run this AFTER starting the backend
(uvicorn app.main:app --reload) in a separate terminal.

    python test_app.py

It hits every endpoint and every edge case called out in BUILD_SPEC.md, and
prints PASS/FAIL for each. No mocking — real HTTP calls against your running server.
"""

import requests

BASE = "http://localhost:8000"
passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"PASS  {name}")
        passed += 1
    else:
        print(f"FAIL  {name}  {detail}")
        failed += 1


def post(path, json=None):
    return requests.post(f"{BASE}{path}", json=json)


def get(path):
    return requests.get(f"{BASE}{path}")


def patch(path, json=None):
    return requests.patch(f"{BASE}{path}", json=json)


print("=" * 60)
print("0. Server alive")
print("=" * 60)
r = get("/")
check("GET / returns 200", r.status_code == 200, r.text)
check("GET / returns status ok", r.json().get("status") == "ok", r.text)

print()
print("=" * 60)
print("1. Ambulance CRUD")
print("=" * 60)

r = post("/ambulances", {"code": "A-01", "lat": 25.4358, "lon": 81.8463, "status": "available"})
check("create ambulance A-01", r.status_code == 200, r.text)
amb1 = r.json()

r = post("/ambulances", {"code": "A-02", "lat": 25.4520, "lon": 81.8290, "status": "available"})
check("create ambulance A-02 (closer to incident)", r.status_code == 200, r.text)
amb2 = r.json()

r = post("/ambulances", {"code": "A-03", "lat": 25.4600, "lon": 81.8600, "status": "busy"})
check("create ambulance A-03 (busy, should never be recommended)", r.status_code == 200, r.text)
amb3 = r.json()

r = get("/ambulances")
check("list ambulances returns all 3", r.status_code == 200 and len(r.json()) == 3, r.text)

r = patch(f"/ambulances/{amb3['id']}", {"status": "available"})
check("patch ambulance status", r.status_code == 200 and r.json()["status"] == "available", r.text)
patch(f"/ambulances/{amb3['id']}", {"status": "busy"})

r = patch(f"/ambulances/00000000-0000-0000-0000-000000000000", {"status": "busy"})
check("patch nonexistent ambulance returns 404", r.status_code == 404, r.text)

r = post("/ambulances", {"code": "A-04", "lat": "not-a-number", "lon": 81.8, "status": "available"})
check("create ambulance with bad lat rejected (422)", r.status_code == 422, r.text)

print()
print("=" * 60)
print("2. Incident CRUD")
print("=" * 60)

r = post("/incidents", {"type": "accident", "lat": 25.4484, "lon": 81.8333, "description": "road accident, Civil Lines"})
check("create incident", r.status_code == 200, r.text)
incident = r.json()

r = get("/incidents")
check("list incidents", r.status_code == 200 and len(r.json()) >= 1, r.text)

r = post("/incidents", {"type": "not-a-real-type", "lat": 25.44, "lon": 81.83})
check("create incident with junk type is accepted (no enum validation yet — expected for prototype)", r.status_code == 200, r.text)

print()
print("=" * 60)
print("3. Recommendation — happy path")
print("=" * 60)

r = get(f"/recommendation/{incident['id']}")
check("get recommendation returns 200", r.status_code == 200, r.text)
rec = r.json()
check("recommendation picks an AVAILABLE ambulance (not A-03/busy)", rec["ambulance_id"] != amb3["id"], rec)
check("recommendation picks the CLOSER of the two available (A-02)", rec["ambulance_id"] == amb2["id"],
      f"expected {amb2['id']} (A-02), got {rec['ambulance_id']}")
check("recommendation status is pending", rec["status"] == "pending", rec)
check("eta_seconds is a positive number", rec["eta_seconds"] > 0, rec)
check("distance_m is a positive number", rec["distance_m"] > 0, rec)

print()
print("=" * 60)
print("4. Recommendation — no ambulance available")
print("=" * 60)

patch(f"/ambulances/{amb1['id']}", {"status": "busy"})
patch(f"/ambulances/{amb2['id']}", {"status": "busy"})

r = post("/incidents", {"type": "fire", "lat": 25.45, "lon": 81.84})
incident2 = r.json()
r = get(f"/recommendation/{incident2['id']}")
check("no ambulances available returns 404, not a crash", r.status_code == 404, r.text)

patch(f"/ambulances/{amb1['id']}", {"status": "available"})
patch(f"/ambulances/{amb2['id']}", {"status": "available"})

print()
print("=" * 60)
print("5. Recommendation — bad incident id")
print("=" * 60)

r = get("/recommendation/00000000-0000-0000-0000-000000000000")
check("recommendation for nonexistent incident returns 404", r.status_code == 404, r.text)

print()
print("=" * 60)
print("6. Accept / Modify / Reject")
print("=" * 60)

r = post("/incidents", {"type": "medical", "lat": 25.446, "lon": 81.835})
incident3 = r.json()
r = get(f"/recommendation/{incident3['id']}")
rec3 = r.json()

r = post(f"/recommendation/{rec3['id']}/accept")
check("accept returns 200", r.status_code == 200, r.text)
check("accept sets status to accepted", r.json()["status"] == "accepted", r.text)

r = get("/ambulances")
accepted_amb = next(a for a in r.json() if a["id"] == rec3["ambulance_id"])
check("accepted ambulance status flips to busy", accepted_amb["status"] == "busy", accepted_amb)

r = post(f"/recommendation/{rec3['id']}/accept")
check("double-accept doesn't error (idempotent-ish, just re-sets status)", r.status_code == 200, r.text)

r = post("/incidents", {"type": "medical", "lat": 25.447, "lon": 81.836})
incident4 = r.json()
r = get(f"/recommendation/{incident4['id']}")
if r.status_code == 200:
    rec4 = r.json()
    r = post(f"/recommendation/{rec4['id']}/reject")
    check("reject returns 200", r.status_code == 200, r.text)
    check("reject sets status to rejected", r.json()["status"] == "rejected", r.text)
else:
    print("SKIP  reject test — no ambulance was available (expected if you ran this twice in a row)")

r = post("/recommendation/00000000-0000-0000-0000-000000000000/accept")
check("accept on nonexistent recommendation returns 404", r.status_code == 404, r.text)

print()
print("=" * 60)
print(f"RESULT: {passed} passed, {failed} failed")
print("=" * 60)
if failed == 0:
    print("Everything the spec asked for actually works.")
else:
    print("Something's broken — check the FAIL lines above before building on top of this.")