# Real-Data Airspace Simulator

This repository starts the simulator as a small, testable vertical slice:

- **C++20** owns deterministic simulation math in `core/`.
- **Rust** owns the HTTP service boundary in `services/api/`.
- **TypeScript** owns the browser demo in `frontend/`.

The current model is intentionally simple: constant true airspeed and climb rate,
plus a constant wind vector. It is a stable foundation for adding atmosphere,
aerodynamics, real ADS-B records, and prediction error metrics without coupling
the UI to the physics implementation.

The C++ core uses a polymorphic `AircraftDynamics` interface. The default
`ConstantVelocityDynamics` preserves the first vertical slice, while future
models (for example an atmosphere-aware transport model or an engine-out model)
can be selected without changing the simulation loop.

The frontend includes safe decision-support views for airspace awareness,
search-and-rescue coordination, logistics monitoring, and after-action replay.
These views are for simulation and training, not operational control, targeting,
or navigation.

The traffic dashboard supports two explicit data sources:

- **Simulated**: deterministic local aircraft tracks and replay controls. This
  works without a network connection or provider account.
- **Live**: current Ben Gurion-area OpenSky state vectors, refreshed every 15
  seconds through the local API proxy.

Use the **DATA SOURCE** switch above the map to move between them. The selected
source is always shown in the traffic subtitle and status metric; the app does
not silently mix simulated and live aircraft.

## Run the C++ core

```sh
cmake -S . -B build
cmake --build build
ctest --test-dir build --output-on-failure
./build/simulator-cli 60 120 2
```

The CLI emits a JSON trajectory. The arguments are duration in seconds,
true airspeed in m/s, and climb rate in m/s.

## Run the Rust API

Install Rust, then run:

```sh
cargo run --manifest-path services/api/Cargo.toml
```

Set `AIRSPACE_SIMULATOR` to the absolute path of `simulator-cli` if it is not
on `PATH`. The API exposes `/health` and `/api/v1/simulate`.

For a local demo without installing Rust, run the dependency-free Node
development API instead:

```sh
node services/api/dev-server.js
```

It invokes the built C++ simulator and exposes the same endpoints on port 8080.

The local API also proxies a Ben Gurion (`LLBG`) OpenSky state-vector query and
classifies nearby aircraft as likely inbound or outbound from their motion:

```sh
curl http://127.0.0.1:8080/api/v1/traffic?airport=LLBG
```

Live provider data is best-effort and subject to OpenSky coverage, quotas, and
availability. The UI marks the live state unavailable rather than fabricating
positions. Inbound/outbound labels are inferences from live position and
heading, not official airport arrival or departure schedules.

## Frontend

`frontend/index.html` and `frontend/app.ts` are intentionally dependency-light.
Serve the directory with a TypeScript-capable dev server and click **Run sample
simulation** after the API is running.

## Design boundaries

The project is educational and is **not for real navigation or ATC**. Future
milestones should add, in order: typed scenario input, recorded ADS-B storage,
weather normalization, a tested atmosphere model, prediction-vs-real metrics,
and only then richer map visualization.
