const button = document.querySelector("#run");
const timeline = document.querySelector("#timeline");
const replayTime = document.querySelector("#replay-time");
const playButton = document.querySelector("#play");
const layer = document.querySelector("#aircraft-layer");
const route = document.querySelector("#simulated-route");
const sourceButtons = document.querySelectorAll(".data-source");
const sourceNote = document.querySelector("#source-note");
const refreshLive = document.querySelector("#refresh-live");
let samples = [];
let playing = false;
let timer;
let dataSource = "simulated";

const realAircraft = [
  { id: "ELY321", x: 300, y: 306, selected: true },
  { id: "ISR412", x: 520, y: 232 },
  { id: "WZZ18", x: 700, y: 138 },
  { id: "RYR7PX", x: 444, y: 270 },
  { id: "EJU74", x: 610, y: 205 },
];

function drawAircraft() {
  layer.innerHTML = realAircraft.map((aircraft) => `
    <g class="aircraft ${aircraft.selected ? "selected-aircraft" : ""}" transform="translate(${aircraft.x} ${aircraft.y})">
      <circle r="${aircraft.selected ? 16 : 11}" class="aircraft-ring"></circle>
      <path d="M0 -9 L4 8 L0 5 L-4 8 Z" class="aircraft-shape"></path>
      <text x="14" y="4">${aircraft.id}</text>
    </g>`).join("");
}

function drawLiveAircraft(states) {
  const bounds = { minLon: 34.55, maxLon: 35.25, minLat: 31.75, maxLat: 32.35 };
  const live = states.slice(0, 40).map((aircraft) => ({
    id: aircraft.callsign || aircraft.icao24,
    x: ((aircraft.longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 900,
    y: 470 - ((aircraft.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 470,
  }));
  layer.innerHTML = live.map((aircraft) => `
    <g class="aircraft" transform="translate(${aircraft.x} ${aircraft.y})">
      <circle r="9" class="aircraft-ring"></circle>
      <path d="M0 -8 L4 7 L0 4 L-4 7 Z" class="aircraft-shape"></path>
      <text x="11" y="4">${aircraft.id}</text>
    </g>`).join("");
}

async function loadLiveTraffic() {
  if (dataSource !== "live") return;
  try {
    const response = await fetch("http://127.0.0.1:8080/api/v1/traffic?airport=LLBG");
    if (!response.ok) throw new Error("provider unavailable");
    const traffic = await response.json();
    drawLiveAircraft(traffic.states);
    document.querySelector("#aircraft-count").textContent = traffic.states.length;
    document.querySelector("#traffic-status").textContent = "Live · OpenSky";
    document.querySelector("#traffic-subtitle").textContent = "Ben Gurion · live ADS-B state vectors";
  } catch {
    document.querySelector("#traffic-status").textContent = "Live data unavailable";
    document.querySelector("#traffic-status").classList.add("negative");
  }
}

function setSource(source) {
  dataSource = source;
  sourceButtons.forEach((sourceButton) => {
    sourceButton.classList.toggle("active", sourceButton.dataset.source === source);
  });

  const title = document.querySelector("#replay-title");
  if (source === "live") {
    sourceNote.textContent = "Refreshing every 15 seconds";
    document.querySelector("#traffic-subtitle").textContent = "Ben Gurion · OpenSky live state vectors";
    title.textContent = "Live traffic stream";
    loadLiveTraffic();
    return;
  }

  sourceNote.textContent = "Safe offline demo data";
  document.querySelector("#traffic-subtitle").textContent = "Deterministic point-mass simulation";
  document.querySelector("#traffic-status").textContent = "Simulated · local";
  document.querySelector("#traffic-status").classList.remove("negative");
  title.textContent = "Simulation replay";
  drawAircraft();
  document.querySelector("#aircraft-count").textContent = "5";
}

function formatFlightTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "time unknown";
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderFlightRows(elementId, flights, direction) {
  const container = document.querySelector(`#${elementId}`);
  if (!container) return;
  if (!flights.length) {
    container.innerHTML = '<div class="empty-row">No flights observed in this window</div>';
    return;
  }
  container.innerHTML = flights.slice(0, 6).map((flight) => {
    const route = direction === "arrival" ? "Approaching LLBG" : "Departing LLBG";
    return `<div class="flight-row"><span class="flight-code">${flight.callsign}</span><span>${route}</span><time>${Math.round((flight.distanceFromAirportDegrees || 0) * 60)} NM</time></div>`;
  }).join("");
}

async function loadAirportActivity() {
  try {
    const response = await fetch("http://127.0.0.1:8080/api/v1/flights?airport=LLBG");
    if (!response.ok) throw new Error("provider unavailable");
    const activity = await response.json();
    renderFlightRows("arrivals", activity.arrivals, "arrival");
    renderFlightRows("departures", activity.departures, "departure");
    document.querySelector("#arrival-count").textContent = activity.arrivals.length;
    document.querySelector("#departure-count").textContent = activity.departures.length;
    document.querySelector("#flight-activity-status").textContent = "OpenSky · live inferred";
  } catch {
    document.querySelector("#flight-activity-status").textContent = "Unavailable";
    document.querySelector("#arrivals").innerHTML = '<div class="empty-row">Live flight activity unavailable</div>';
    document.querySelector("#departures").innerHTML = '<div class="empty-row">Live flight activity unavailable</div>';
  }
}

function updateTimeline(value) {
  const seconds = Number(value);
  replayTime.textContent = `T+00:${String(seconds).padStart(2, "0")} / 01:00`;
  if (dataSource === "simulated" && samples.length) {
    const sample = samples[Math.min(seconds, samples.length - 1)];
    const x = 300 + (sample.east_m / 7200) * 540;
    const y = 306 - (sample.north_m / 7200) * 220;
    const selected = document.querySelector(".selected-aircraft");
    if (selected) selected.setAttribute("transform", `translate(${x} ${y})`);
  }
}

button?.addEventListener("click", async () => {
  button.disabled = true;
  button.innerHTML = "Running prediction <span>…</span>";
  try {
    const response = await fetch("http://127.0.0.1:8080/api/v1/simulate");
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    ({ samples } = await response.json());
    document.querySelector("#prediction-count").textContent = "01";
    button.innerHTML = "Prediction complete <span>✓</span>";
    timeline.value = "0";
    updateTimeline(0);
  } catch {
    button.innerHTML = "API unavailable <span>!</span>";
  } finally {
    setTimeout(() => { button.disabled = false; }, 1200);
  }
});

timeline?.addEventListener("input", (event) => updateTimeline(event.target.value));
sourceButtons.forEach((sourceButton) => {
  sourceButton.addEventListener("click", () => setSource(sourceButton.dataset.source));
});
refreshLive?.addEventListener("click", () => {
  if (dataSource === "live") loadLiveTraffic();
});
playButton?.addEventListener("click", () => {
  playing = !playing;
  playButton.textContent = playing ? "Ⅱ" : "▶";
  if (playing) {
    timer = setInterval(() => {
      const next = Number(timeline.value) + 1;
      timeline.value = String(next > 60 ? 0 : next);
      updateTimeline(timeline.value);
    }, 500);
  } else clearInterval(timer);
});

drawAircraft();
setSource("simulated");
setInterval(loadLiveTraffic, 15000);
loadAirportActivity();
setInterval(loadAirportActivity, 60000);

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const mode = button.dataset.mode;
    const sarPanel = document.querySelector("#sar-panel");
    const title = document.querySelector(".topbar h1");
    const eyebrow = document.querySelector(".topbar .eyebrow");
    document.querySelectorAll(".module-panel, #sar-panel").forEach((panel) => { panel.hidden = true; });
    if (mode === "sar") {
      sarPanel.hidden = false;
      eyebrow.textContent = "MISSION / SEARCH AND RESCUE";
      title.childNodes[0].textContent = "Coastal search operation ";
    } else if (mode === "logistics") {
      document.querySelector("#logistics-panel").hidden = false;
      eyebrow.textContent = "FLEET OPERATIONS / LOGISTICS";
      title.childNodes[0].textContent = "Movement status ";
    } else if (mode === "after-action") {
      document.querySelector("#after-action-panel").hidden = false;
      eyebrow.textContent = "REVIEW / AFTER-ACTION";
      title.childNodes[0].textContent = "Mission replay analysis ";
    } else {
      document.querySelector("#geofence-panel").hidden = false;
      eyebrow.textContent = "AIRSPACE SAFETY / GEOFENCES";
      title.childNodes[0].textContent = "Restricted zones ";
      if (mode === "airspace") {
        document.querySelector("#geofence-panel").hidden = true;
        eyebrow.textContent = "REGION / ISRAEL";
        title.childNodes[0].textContent = "Ben Gurion airspace ";
      }
    }
  });
});

document.querySelectorAll(".grid-cell").forEach((cell) => {
  cell.addEventListener("click", () => {
    document.querySelectorAll(".grid-cell").forEach((item) => item.classList.remove("active"));
    cell.classList.add("active");
  });
});

fetch("http://127.0.0.1:8080/api/v1/simulate").then((response) => response.json()).then((data) => {
  samples = data.samples;
  updateTimeline(0);
}).catch(() => {});
