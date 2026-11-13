cmake_minimum_required(VERSION 3.20)
project(airspace_simulator LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(airspace_core
    core/src/simulation.cpp
)
target_include_directories(airspace_core PUBLIC core/include)
target_compile_options(airspace_core PRIVATE -Wall -Wextra -Wpedantic)

add_executable(simulator-cli core/src/main.cpp)
target_link_libraries(simulator-cli PRIVATE airspace_core)

enable_testing()
add_executable(airspace_core_tests core/tests/simulation_tests.cpp)
target_link_libraries(airspace_core_tests PRIVATE airspace_core)
add_test(NAME airspace_core_tests COMMAND airspace_core_tests)
