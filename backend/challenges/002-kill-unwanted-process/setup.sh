#!/bin/bash

# Create python script that sleep for a long time
echo 'import time
time.sleep(30000)' > /tmp/unwanted_process.py
# Start the python script in the background
( python3 /tmp/unwanted_process.py & echo $! > /tmp/unwanted_process.pid ) &
# Get the PID of the last background process
UNWANTED_PID=$!
# Save the PID to a file for validation
echo $UNWANTED_PID > /tmp/unwanted_process.pid