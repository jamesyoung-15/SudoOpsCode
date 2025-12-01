#!/bin/bash

if [ ! -f /tmp/csv_sorted ]; then
    echo "Validation failed: Write your sorted output to /tmp/csv_sorted."
    exit 1
fi

if diff -q /tmp/csv_sorted /tmp/csv_expected >/dev/null; then
    echo "Validation passed."
    exit 0
else
    echo "Validation failed: Output does not match expected sorting."
    exit 1
fi
