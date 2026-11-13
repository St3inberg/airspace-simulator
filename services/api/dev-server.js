const http = require("node:http");
const { execFile } = require("node:child_process");
const path = require("node:path");
const https = require("node:https");

const port = Number(process.env.AIRSPACE_API_PORT || 8080);
const simulator = process.env.AIRSPACE_SIMULATOR ||
  path.resolve(__dirname, "../../build/simulator-cli");

function send(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

function fetchOpenSky() {
  const query = new URLSearchParams({
    lamin: "31.75",
    lamax: "32.35",
    lomin: "34.55",
    lomax: "35.25",
  });
  return new Promise((resolve, reject) => {
    const request = https.get(
      `https://opensky-network.org/api/states/all?${query}`,
      { headers: { Accept: "application/json", "User-Agent": "airspace-simulator/0.1" } },
      (upstream) => {
        let body = "";
        upstream.setEncoding("utf8");
        upstream.on("data", (chunk) => { body += chunk; });
        upstream.on("end", () => {
          if (upstream.statusCode !== 200) {
            reject(new Error(`OpenSky returned HTTP ${upstream.statusCode}`));
            return;
          }
          try {
            const payload = JSON.parse(body);
            const states = (payload.states || []).map((state) => ({
              icao24: state[0],
              callsign: (state[1] || "").trim() || null,
              longitude: state[5],
              latitude: state[6],
              baroAltitudeM: state[7],
              onGround: state[8],
              velocityMps: state[9],
              trackRad: state[10],
              verticalRateMps: state[11],
              lastContact: state[4],
            })).filter((aircraft) =>
              Number.isFinite(aircraft.latitude) && Number.isFinite(aircraft.longitude)
            );
            resolve({ timestamp: payload.time, source: "OpenSky", airport: "LLBG", states });
          } catch (error) {
            reject(new Error(`invalid OpenSky response: ${error.message}`));
          }
        });
      }
    );
    request.setTimeout(10000, () => request.destroy(new Error("OpenSky request timed out")));
    request.on("error", reject);
  });
}

function fetchOpenSkyFlights(direction) {
  const now = Math.floor(Date.now() / 1000);
  const query = new URLSearchParams({
    airport: "LLBG",
    begin: String(now - 2 * 60 * 60),
    end: String(now),
  });
  const endpoint = direction === "arrivals" ? "arrival" : "departure";
  return new Promise((resolve, reject) => {
    const request = https.get(
      `https://opensky-network.org/api/flights/${endpoint}?${query}`,
      { headers: { Accept: "application/json", "User-Agent": "airspace-simulator/0.1" } },
      (upstream) => {
        let body = "";
        upstream.setEncoding("utf8");
        upstream.on("data", (chunk) => { body += chunk; });
        upstream.on("end", () => {
          if (upstream.statusCode !== 200) {
            reject(new Error(`OpenSky returned HTTP ${upstream.statusCode}`));
            return;
          }
          try {
            const flights = (JSON.parse(body) || []).map((flight) => ({
              icao24: flight.icao24,
              callsign: (flight.callsign || "").trim() || flight.icao24,
              firstSeen: flight.firstSeen,
              lastSeen: flight.lastSeen,
              origin: flight.estDepartureAirport,
              destination: flight.estArrivalAirport,
            }));
            resolve({ airport: "LLBG", direction, windowMinutes: 120, flights });
          } catch (error) {
            reject(new Error(`invalid OpenSky flight response: ${error.message}`));
          }
        });
      }
    );
    request.setTimeout(10000, () => request.destroy(new Error("OpenSky request timed out")));
    request.on("error", reject);
  });
}

function classifyNearbyTraffic(states) {
  const airport = { latitude: 32.011, longitude: 34.886 };
  const toRadians = (degrees) => degrees * Math.PI / 180;
  return states.map((aircraft) => {
    const east = (airport.longitude - aircraft.longitude) * Math.cos(toRadians(airport.latitude));
    const north = airport.latitude - aircraft.latitude;
    const distance = Math.sqrt(east ** 2 + north ** 2);
    const headingEast = Math.sin(aircraft.trackRad || 0);
    const headingNorth = Math.cos(aircraft.trackRad || 0);
    const towardAirport = east * headingEast + north * headingNorth;
    return {
      ...aircraft,
      distanceFromAirportDegrees: distance,
      movement: aircraft.onGround ? "ground" : towardAirport > 0 ? "inbound" : "outbound",
    };
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method !== "GET") {
    send(response, 405, { error: "method not allowed" });
    return;
  }

  if (request.url === "/health") {
    send(response, 200, { status: "ok", runtime: "node-dev-api" });
    return;
  }

  if (request.url === "/api/v1/simulate") {
    execFile(simulator, ["60", "120", "2"], (error, stdout, stderr) => {
      if (error) {
        send(response, 503, {
          error: "simulator failed",
          detail: stderr.trim() || error.message,
        });
        return;
      }
      try {
        send(response, 200, JSON.parse(stdout));
      } catch {
        send(response, 502, { error: "simulator returned invalid JSON" });
      }
    });
    return;
  }

  if (request.url === "/api/v1/traffic?airport=LLBG") {
    fetchOpenSky()
      .then((traffic) => send(response, 200, traffic))
      .catch((error) => send(response, 502, {
        error: "live traffic unavailable",
        detail: error.message,
        airport: "LLBG",
      }));
    return;
  }

  if (request.url === "/api/v1/flights?airport=LLBG") {
    fetchOpenSky()
      .then((traffic) => {
        const classified = classifyNearbyTraffic(traffic.states)
        .filter((aircraft) => aircraft.distanceFromAirportDegrees < 0.9);
        send(response, 200, {
        airport: "LLBG",
        updatedAt: Math.floor(Date.now() / 1000),
        source: "OpenSky live state vectors",
        note: "Inbound and outbound labels are inferred from aircraft motion, not official schedules.",
        arrivals: classified.filter((aircraft) => aircraft.movement === "inbound"),
        departures: classified.filter((aircraft) => aircraft.movement === "outbound"),
        });
      })
      .catch((error) => send(response, 502, {
        error: "airport flight activity unavailable",
        detail: error.message,
        airport: "LLBG",
      }));
    return;
  }

  send(response, 404, { error: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`airspace dev API listening on http://127.0.0.1:${port}`);
});
