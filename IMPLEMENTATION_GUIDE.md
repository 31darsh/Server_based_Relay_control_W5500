# Implementation Guide - W5500 LAN Module Fix

## Summary
**Issue:** W5500 LAN module LED flickering, "not connected" status, unable to ping device  
**Root Cause:** Insufficient PHY initialization delay, missing link stability checking  
**Fix Applied:** Added network state machine with proper timing and debouncing

## What Was Changed

### File: `Core/Src/app_relay.c`

**Changes:**
1. Added network state machine (NETSTATE_RESET → INIT → PHY_INIT → PHY_STABLE → READY)
2. Extended W5500 reset timing: 50ms→100ms pulse, 200ms→500ms wait
3. Added PHY link debouncing (3-check stability requirement)
4. Moved socket operations behind readiness check
5. Added improved debug logging

**Compilation Status:** ✓ SUCCESS (Server_based_Relay_controll.elf created)

## How to Test

### Step 1: Flash Firmware
1. Open your STM32 IDE (STM32CubeIDE)
2. Open project at: `d:\PECSOL\Server_based_Relay_controll`
3. Build → Build Project
4. Debug → Debug As → STM32 MCU C/C++ Application
5. Flash to your STM32F103C8TX board

### Step 2: Monitor Serial Output
1. Connect USB cable to device
2. Open serial monitor at **115200 baud**
3. Should see initialization sequence:
   ```
   [info] application initialized
   W5500 hardware reset complete - entering init state
   W5500 SPI callbacks registered
   W5500 wizchip initialized
   PHY auto-negotiation phase complete, entering stability check
   PHY link stable - network ready for socket operations
   [info] ethernet link detected - ready
   ```

### Step 3: Test Connectivity
```bash
ping 192.168.31.50

# Expected response:
# Pinging 192.168.31.50 with 32 bytes of data:
# Reply from 192.168.31.50: bytes=32 time<1ms TTL=64
# Reply from 192.168.31.50: bytes=32 time<1ms TTL=64
# Ping statistics: Sent=4, Received=4, Lost=0 (0% loss)
```

### Step 4: Verify Server Connection
1. Check that your backend server receives connection from device
2. Look for "hello" message in server logs
3. Relay should send periodic heartbeats (every 5 seconds)

## Specific Timing Changes

| Component | Before | After | Purpose |
|-----------|--------|-------|---------|
| RESET pulse | 50ms | 100ms | Ensure proper PLL reset |
| Wait after reset | 200ms | 500ms | Allow PLL lock (≤200ms) + Auto-neg start (≤300ms) |
| PHY init phase | None | 500ms | Wait for Ethernet link auto-negotiation |
| Link debounce count | N/A | 3 checks | Prevent false positives |
| PHY timeout | None | 2000ms | Diagnostic timeout for debugging |

## Expected Results

### Before Fix:
- LED: Rapid on/off flicker (1-2 second cycle)
- Ping: "Destination host unreachable"
- Socket: Continuous open/close/open/close cycle

### After Fix:
- LED: Steady ON (stable connection)
- Ping: Replies within <1ms
- Socket: Persistent connection, heartbeats every 5s
- Server: Receives messages from device

## Troubleshooting

### Symptom: Still flickering after flash
**Check:**
1. [ ] Did you rebuild the **entire** project (not just app_relay.c)?
2. [ ] Did you flash the **new** .elf file (check timestamp)?
3. [ ] Are you seeing the initialization logs? (If not, old firmware is still running)

**Solution:** 
- Rebuild: `Debug` → `Remove All Objects`
- Flash: Use STM32 Programmer to erase chip completely

### Symptom: Seeing "PHY link timeout"
**This means Ethernet link not detected after 2 seconds**

**Check Hardware:**
1. [ ] Ethernet cable plugged in?
2. [ ] LED on Ethernet port lit? (usually green)
3. [ ] Try different cable
4. [ ] Connect directly to router (not through switch)
5. [ ] Check W5500 module power supply (should be 3.3V ±5%)

### Symptom: Application initialized but no LED change
**Check:**
1. [ ] Is GPIO for indicator LED configured correctly?
2. [ ] Is LED circuit wired properly (not inverted)?
3. [ ] Does LED light during "startup"? (tests GPIO)

### Symptom: Successfully connecting but unstable
**Check:**
1. [ ] Is your backend server still running?
2. [ ] Network stability (try hard-wired from router)
3. [ ] Check logs for socket errors

## Performance Characteristics

### Startup Time
- **Total initialization:** ~1.2 seconds (from reset to NETSTATE_READY)
  - Power-on: 500ms
  - SPI init: 50ms
  - PHY negotiation: 500ms
  - Link debounce: 150ms

### Runtime
- **Heartbeat:** 5000ms
- **Status push:** 15000ms
- **Server reconnect:** 3000ms retry interval
- **Link check:** Every Socket_Process() call (continuous)

## Files Modified

```
Core/Src/app_relay.c
├── Added: net_state_t enum and state machine
├── Added: G6 new timing constants (PHY_INIT_TIMEOUT_MS, etc)
├── Modified: W5500_HardwareReset() - timing extended
├── Modified: Network_Init() - deferred initialization
├── Added: Network_StateProcess() - state machine
├── Modified: Socket_Process() - added readiness check
├── Modified: App_Relay_Process() - added state processing
└── Added: Phy_IsStable() - debounced link check
```

**No other files modified** - changes are isolated to application layer

## Version Information

```
Project: Server_based_Relay_controll
Controller: STM32F103C8TX
Network Module: W5500 Ethernet
Fix Version: 1.1.0 (Improved initialization)
Date: 2026-04-01
```

## Support & Further Debugging

If issues persist, collect this information:
1. Serial monitor log (capture full startup)
2. Oscilloscope traces of SPI, RESET, CS pins
3. Multimeter reading of W5500 power supply
4. Picture of board connections
5. Network topology (device → switch → router?)

The debug messages will help identify exactly where initialization fails.
