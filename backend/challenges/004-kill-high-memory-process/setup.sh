#!/bin/bash

# Memory allocation script that uses >65MB
cat > /tmp/mem_hog.py << 'EOF'
x = bytearray(80 * 1024 * 1024)
import time
time.sleep(30000)
EOF

# Harmless sleeper
cat > /tmp/sleeper.py << 'EOF'
import time
time.sleep(30000)
EOF

setsid python3 /tmp/mem_hog.py >/dev/null 2>&1 &
MEM_PID=$!

setsid python3 /tmp/sleeper.py >/dev/null 2>&1 &
SLEEP_PID=$!

echo $MEM_PID >/tmp/mem_target.pid