#include "airspace/simulation.hpp"

#include <cstdlib>
#include <iomanip>
#include <iostream>

int main(int argc, char** argv) {
    const double duration = argc > 1 ? std::atof(argv[1]) : 60.0;
    const double speed = argc > 2 ? std::atof(argv[2]) : 120.0;
    const double climb_rate = argc > 3 ? std::atof(argv[3]) : 0.0;

    const airspace::ConstantVelocityDynamics dynamics;
    const auto samples = airspace::simulate(
        {.0, .0, 1000.0, speed, 0.0, climb_rate},
        {.0, .0},
        {1.0, duration},
        dynamics
    );

    std::cout << "{\"samples\":[";
    for (std::size_t i = 0; i < samples.size(); ++i) {
        if (i != 0) std::cout << ',';
        const auto& sample = samples[i];
        std::cout << std::setprecision(10)
                  << "{\"t\":" << i
                  << ",\"east_m\":" << sample.east_m
                  << ",\"north_m\":" << sample.north_m
                  << ",\"altitude_m\":" << sample.altitude_m << '}';
    }
    std::cout << "]}\n";
}
