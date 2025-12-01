#!/bin/bash

EXPECTED=$(cat /tmp/largest_expected)

if [ ! -f /tmp/largest_found ]; then
    echo "Validation failed: Write the path of the largest file to /tmp/largest_found."
    exit 1
fi

FOUND=$(cat /tmp/largest_found)

if [ "$FOUND" = "$EXPECTED" ]; then
    echo "Validation passed."
    exit 0
else
    echo "Validation failed: Expected $EXPECTED but got $FOUND."
    exit 1
fi