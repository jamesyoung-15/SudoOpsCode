#!/bin/bash

# Create a CPU‑hogging Python script
cat > /tmp/cpu_hog.py << 'EOF'
while True:
    pass
EOF

# Start the CPU hog, detached
setsid python3 /tmp/cpu_hog.py >/dev/null 2>&1 &
echo $! >/tmp/cpu_hog.pid