# W5500 LAN Module Debug Analysis

## Problem Symptoms
- LED shows "not connected" status
- LED behavior: on/off flickering (~1-2 seconds)
- Cannot ping device at 192.168.31.50
- Indicator: Device is likely resetting or link detection cycles rapidly

## Root Cause Analysis

### 1. **PHY Link Initialization Timing Issue**
**Current Flow:**
- W5500_HardwareReset() → 50ms delay, then 200ms delay
- Network_Init() → wizchip_init() called
- Socket_Process() → Phy_IsUp() checked immediately

**Problem:**
- W5500 PHY needs **500-1000ms minimum** after reset to complete auto-negotiation
- Ethernet link detection is being checked before PHY is ready
- When Phy_IsUp() returns false (link not ready), Socket_EnsureConnected() closes socket
- This repeats every 3000ms (RECONNECT_INTERVAL_MS), causing flickering

### 2. **Missing PHY Timeout Handling**
- No wait mechanism for PHY to establish link
- No exponential backoff for reconnection attempts
- Socket is immediately discarded when link is not detected

### 3. **Initialization Sequence Issues**
Current (WRONG):
```
W5500_Reset (50+200ms)
  → wizchip_init()
    → Check Phy_IsUp() in next tick
```

Should be:
```
W5500_Reset (200ms minimum)
  → wizchip_init()
    → PHY_Init (set speed/duplex)
      → Wait for link (500-1000ms)
        → Socket operations
```

## Solution: Enhanced Network Initialization

### Required Changes:
1. Add PHY initialization with proper timing
2. Add state machine for network startup
3. Extend initialization delay to allow PHY stabilization
4. Add PHY link stability check (debounce)

## Testing Strategy
1. Monitor USB debug output for initialization sequence
2. Check W5500 register values (PHY register 0x01 for link status)
3. Verify 500ms+ delay after init before socket operations
4. Test with different Ethernet cables
5. Check if power supply is stable (W5500 requires clean power)

## Hardware Checks
- [ ] Verify W5500 power supply voltage (3.3V ±5%)
- [ ] Check SPI clock signal with oscilloscope
- [ ] Verify CS pin transitions (should be high during idle)
- [ ] Check RESET pin was toggled during boot
- [ ] Confirm Ethernet cable is properly connected
- [ ] Test with direct router connection (not through switch)
