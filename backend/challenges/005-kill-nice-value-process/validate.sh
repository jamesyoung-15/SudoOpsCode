#!/bin/bash

PID=$(cat /tmp/nice_target.pid)

# Check if the target nice-value process is gone
if ps -p "$PID" >/dev/null 2>&1; then
    echo "Validation failed: The process with nice value 10 is still running."
    exit 1
else
    echo "Validation passed: The nice-10 process has been terminated."
    exit 0
fi