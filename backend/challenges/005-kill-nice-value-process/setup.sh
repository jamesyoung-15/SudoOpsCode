#!/bin/bash

# Start two Python sleep processes with different nice values
setsid nice -n 0  python3 -c "import time; time.sleep(30000)" >/dev/null 2>&1 &
PID_NORMAL=$!

setsid nice -n 10 python3 -c "import time; time.sleep(30000)" >/dev/null 2>&1 &
PID_NICED=$!

echo $PID_NICED >/tmp/nice_target.pid