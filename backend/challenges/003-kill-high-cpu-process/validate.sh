#!/bin/bash

if [ ! -f /tmp/cpu_hog.pid ]; then
    echo "Validation failed: PID file not found."
    exit 1
fi

PID=$(cat /tmp/cpu_hog.pid)

# Check if process is gone
if ps -p "$PID" >/dev/null 2>&1; then
    echo "Validation failed: CPU hog process (PID $PID) is still running."
    exit 1
else
    echo "Validation passed: CPU hog process has been terminated."
    exit 0
fi