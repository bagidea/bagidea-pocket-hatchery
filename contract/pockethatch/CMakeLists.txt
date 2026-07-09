cmake_minimum_required(VERSION 3.16)
project(pockethatch)

find_package(cdt)

add_contract(
    pockethatch
    pockethatch
    pockethatch.cpp
    pockethatch.hpp
)
