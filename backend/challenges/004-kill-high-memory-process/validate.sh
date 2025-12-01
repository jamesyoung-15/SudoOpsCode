#!/bin/bash

PID=$(cat /tmp/mem_target.pid)

if ps -p "$PID" >/dev/null 2>&1; then
    echo "Validation failed: Memory-hogging process is still running."
    exit 1
else
    echo "Validation passed: Memory-hogging process has been terminated."
    exit 0
fi