#!/bin/bash
# Ping Test Script for W5500 Relay Device

echo "Testing W5500 Relay Device Ping Response..."
echo "Device IP: 192.168.31.50"
echo "Your IP: 192.168.31.101"
echo ""

echo "Step 1: Checking ARP table (should be empty initially)"
arp -a | findstr 192.168.31.50 || echo "No ARP entry found (expected)"

echo ""
echo "Step 2: Pinging device..."
ping -n 4 192.168.31.50

echo ""
echo "Step 3: Checking ARP table after ping"
arp -a | findstr 192.168.31.50 || echo "Still no ARP entry - device not responding"

echo ""
echo "Step 4: Testing TCP connection to backend server"
echo "Checking if backend server is running on port 9000..."
netstat -ano | findstr :9000 | findstr LISTENING && echo "✓ Backend server is running" || echo "✗ Backend server not running"

echo ""
echo "Expected Results:"
echo "- Ping should show replies with <1ms latency"
echo "- ARP table should show device MAC address"
echo "- Serial monitor should show 'ICMP echo reply sent'"</content>
<parameter name="filePath">d:\PECSOL\Server_based_Relay_controll\test_ping.bat