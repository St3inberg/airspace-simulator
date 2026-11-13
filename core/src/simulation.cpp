#include "airspace/simulation.hpp"

#include <cmath>
#include <stdexcept>

namespace airspace {

AircraftState ConstantVelocityDynamics::advance(
    const AircraftState& state,
    Wind wind,
    double step_seconds
) const {
    const double east_velocity = state.true_airspeed_mps * std::sin(state.heading_rad);
    const double north_velocity = state.true_airspeed_mps * std::cos(state.heading_rad);

    AircraftState next = state;
    next.east_m += (east_velocity + wind.east_mps) * step_seconds;
    next.north_m += (north_velocity + wind.north_mps) * step_seconds;
    next.altitude_m += state.climb_rate_mps * step_seconds;
    return next;
}

std::vector<AircraftState> simulate(
    AircraftState initial,
    Wind wind,
    SimulationConfig config,
    const AircraftDynamics& dynamics
) {
    if (config.step_seconds <= 0.0 || config.duration_seconds < 0.0) {
        throw std::invalid_argument("simulation step must be positive and duration non-negative");
    }

    const auto sample_count = static_cast<std::size_t>(
        std::floor(config.duration_seconds / config.step_seconds)
    ) + 1U;
    std::vector<AircraftState> result;
    result.reserve(sample_count);
    result.push_back(initial);

    for (std::size_t i = 1; i < sample_count; ++i) {
        initial = dynamics.advance(initial, wind, config.step_seconds);
        result.push_back(initial);
    }
    return result;
}

std::vector<AircraftState> simulate(
    AircraftState initial,
    Wind wind,
    SimulationConfig config
) {
    static const ConstantVelocityDynamics default_dynamics;
    return simulate(initial, wind, config, default_dynamics);
}

}  // namespace airspace
