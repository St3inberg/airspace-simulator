#pragma once

#include <cstddef>
#include <vector>

namespace airspace {

struct AircraftState {
    double east_m{0.0};
    double north_m{0.0};
    double altitude_m{0.0};
    double true_airspeed_mps{0.0};
    double heading_rad{0.0};
    double climb_rate_mps{0.0};
};

struct Wind {
    double east_mps{0.0};
    double north_mps{0.0};
};

struct SimulationConfig {
    double step_seconds{1.0};
    double duration_seconds{60.0};
};

class AircraftDynamics {
public:
    virtual ~AircraftDynamics() = default;

    virtual AircraftState advance(
        const AircraftState& state,
        Wind wind,
        double step_seconds
    ) const = 0;
};

class ConstantVelocityDynamics final : public AircraftDynamics {
public:
    AircraftState advance(
        const AircraftState& state,
        Wind wind,
        double step_seconds
    ) const override;
};

std::vector<AircraftState> simulate(
    AircraftState initial,
    Wind wind,
    SimulationConfig config,
    const AircraftDynamics& dynamics
);

std::vector<AircraftState> simulate(
    AircraftState initial,
    Wind wind,
    SimulationConfig config
);

}  // namespace airspace
