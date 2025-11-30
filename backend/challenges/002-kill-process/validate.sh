#!/bin/bash

# Read the unwanted process PID from the file
if [ ! -f /tmp/unwanted_process.pid ]; then
    echo "Validation failed: PID file /tmp/unwanted_process.pid not found."
    exit 1
fi

UNWANTED_PID=$(cat /tmp/unwanted_process.pid)

# Check if the process is still running
if ps -p $UNWANTED_PID > /dev/null 2>&1; then
    echo "Validation failed: Process with PID $UNWANTED_PID is still running."
    exit 1
else
    echo "Validation passed: Process with PID $UNWANTED_PID has been terminated."
    exit 0
fi