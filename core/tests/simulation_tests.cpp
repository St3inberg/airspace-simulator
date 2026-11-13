#include "airspace/simulation.hpp"

#include <cassert>
#include <cmath>

namespace {

class FixedClimbDynamics final : public airspace::AircraftDynamics {
public:
    airspace::AircraftState advance(
        const airspace::AircraftState& state,
        airspace::Wind,
        double step_seconds
    ) const override {
        auto next = state;
        next.altitude_m += 10.0 * step_seconds;
        return next;
    }
};

}  // namespace

int main() {
    const auto samples = airspace::simulate(
        {.0, .0, 1000.0, 100.0, 0.0, 2.0},
        {10.0, -5.0},
        {1.0, 2.0}
    );

    assert(samples.size() == 3);
    assert(std::abs(samples[1].east_m - 10.0) < 1e-9);
    assert(std::abs(samples[1].north_m - 95.0) < 1e-9);
    assert(std::abs(samples[2].altitude_m - 1004.0) < 1e-9);

    const FixedClimbDynamics custom_dynamics;
    const auto custom_samples = airspace::simulate(
        {.0, .0, 1000.0, 100.0, 0.0, 2.0},
        {.0, .0},
        {1.0, 2.0},
        custom_dynamics
    );
    assert(std::abs(custom_samples[1].altitude_m - 1010.0) < 1e-9);
    assert(std::abs(custom_samples[2].altitude_m - 1020.0) < 1e-9);
    assert(std::abs(custom_samples[2].north_m) < 1e-9);
}
