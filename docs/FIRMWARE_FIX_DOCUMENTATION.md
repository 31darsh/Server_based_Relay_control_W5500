# W5500 LAN Module - Firmware Fix Documentation

## Changes Made

### 1. **Network State Machine** (NEW)
Added a proper state machine to handle W5500 initialization sequence:

```
NETSTATE_RESET 
  ↓ (Hardware reset complete)
NETSTATE_INIT (wizchip_init after 200ms delay)
  ↓ (Wait 500ms for PHY auto-negotiation)
NETSTATE_PHY_INIT 
  ↓ (Debounce link detection)
NETSTATE_PHY_STABLE (3 consecutive link-up readings)
  ↓
NETSTATE_READY (Socket operations allowed)
```

**Why This Helps:**
- Prevents socket operations during PHY initialization
- Allows Ethernet link auto-negotiation to complete
- Debounces link detection to prevent false disconnects
- Provides clear debug logging of initialization progress

### 2. **Extended Reset Timing**
```c
// OLD: 50ms reset pulse + 200ms wait
HAL_Delay(50);
HAL_GPIO_WritePin(..., GPIO_PIN_SET);
HAL_Delay(200);

// NEW: 100ms reset pulse + 500ms wait
HAL_Delay(100);
HAL_GPIO_WritePin(..., GPIO_PIN_SET);
HAL_Delay(500);  // Allows W5500 clock stabilization
```

**Why This Helps:**
- W5500 internal PLL needs ~200ms after power-on
- Our 100ms reset pulse ensures PLL resets
- 500ms = ~300ms for PLL lock + 200ms buffer for PHY negotiation

### 3. **PHY Link Debouncing**
```c
static uint8_t g_phy_link_debounce = 0;        // New variable
#define PHY_LINK_CHECK_DEBOUNCE 3U;            // New constant

static bool Phy_IsStable(void) {               // New function
    return (g_phy_link_debounce >= 3 && Phy_IsUp());
}
```

**Why This Helps:**
- Prevents socket operations during transient link glitches
- Only considers link "up" after 3 consecutive positive readings
- Avoids rapid socket open/close cycles that cause LED flickering

### 4. **Network State Processing**
```c
void App_Relay_Process(void) {
    Network_StateProcess();  // NEW: State machine runs first
    Socket_Process();        // Socket ops deferred until ready
}
```

**Benefits:**
- Separates initialization concerns from runtime socket handling
- Clear progress through startup phases
- Easy to debug and extend

## Debug Output Progression

When you connect USB serial, you should see this sequence:

```
[info] application initialized
W5500 hardware reset complete - entering init state            <- Reset complete
W5500 SPI callbacks registered
W5500 wizchip initialized                                      <- SPI working
PHY auto-negotiation phase complete, entering stability check  <- Waiting for link
PHY link stable - network ready for socket operations          <- Link detected!
[info] ethernet link detected - ready
[info] server connected
```

If you see the LED stabilize and stay connected, the fix worked!

## Expected Behavior After Fix

### LED Pattern:
- **Before Fix:** Rapid on/off flickering (socket cycling)
- **After Fix:** Steady ON (or appropriate for your LED circuit)

### Ping Response:
```bash
Pinging 192.168.31.50 with 32 bytes of data:
Reply from 192.168.31.50: bytes=32 time<1ms TTL=64
Ping statistics: Sent=4, Received=4, Lost=0 (0% loss)
```

### Server Connection:
- Successfully connects to 192.168.31.101:9000
- Maintains stable heartbeat
- Responds to relay commands

## If Link Still Won't Detect

### Hardware Checks (in this order):
1. **Power Supply**
   - Voltage should be 3.3V ±0.165V (3.135V-3.465V acceptable)
   - Use oscilloscope to check for ripple (should be <100mV)
   - W5500 draws ~100mA during operation

2. **SPI Clock Signal**
   - Oscilloscope on PA5 (SPI_CLK)
   - Should see ~2.25MHz square wave during SPI operations
   - Verify clock transitions are clean (not ringing)

3. **CS Pin (PA4)**
   - Should be: HIGH at idle, LOW during SPI transfer, HIGH after
   - Toggle frequency indicates SPI activity
   - If stuck LOW, SPI may be hung

4. **RESET Pin (PB5)**
   - Verify: LOW (at least 100ms) → HIGH → stays HIGH
   - Check with oscilloscope during boot
   - If stuck LOW, W5500 never powers up

5. **Ethernet Cable**
   - Try a different cable (cross-over cables deprecated but worth trying)
   - Test with direct router connection (bypass switches)
   - Verify all 8 pins connected and pins aren't bent

6. **W5500 Module Signals** (requires oscilloscope)
   - MISO/MOSI transitions during SPI
   - INTRP pin (should pulse when data available)

### Software Checks:
1. Verify SPI is initialized (check main.c MX_SPI1_Init)
2. Check GPIO initialization for CS and RESET pins
3. Verify W5500 part number (should be W5500, not W5100)

### Timeout Issues:
If you see:
```
PHY link timeout - check Ethernet cable
ethernet cable not connected
```

This means after 2 seconds, link wasn't detected. Check:
- [ ] Is Ethernet cable connected?
- [ ] Is there a network-accessible device on the other end?
- [ ] Try plugging into a router (not just a switch)

## Testing Protocol

1. **Serial Monitor Connection**
   ```bash
   # Windows (COM port)
   PuTTY or Arduino IDE Serial Monitor at 115200 baud
   
   # Linux
   screen /dev/ttyACM0 115200
   ```

2. **Boot Sequence Verification**
   - Power on device
   - Should see "hardware reset complete" within 500ms
   - Should see "network ready" within 1-2 seconds
   - LED should stabilize

3. **Connectivity Test**
   ```bash
   ping 192.168.31.50 -c 4
   ```
   Should get 4 replies with <1ms latency

4. **Heartbeat Test**
   - Server should receive JSON heartbeats every 5 seconds
   - Format: `{"type":"heartbeat","deviceId":"relay-f105-01",...}`

## Rollback Instructions

If the fix causes issues, you can revert:

```bash
git checkout Core/Src/app_relay.c
```

The original version is still correct for most conditions - these changes only add better initialization sequencing.

## Additional Improvements for Future

1. **PHY Register Debugging**
   - Read W5500 PHY_REG_01 (mode/status) to see link speed/duplex
   - Can add detailed PHY diagnostics to startup logs

2. **Configurable Auto-Negotiation Timeout**
   - Currently hardcoded to 2000ms
   - Could make user-configurable for poor network conditions

3. **Link Loss Recovery**
   - Current code logs link loss but continues trying to connect
   - Could implement more aggressive recovery (soft reset)

4. **Temperature Compensation**
   - W5500 may need timing adjustments if operating outside 0-70°C

5. **Ethernet Cable Auto-Detection**
   - Detect cable insertion/removal events
   - Provide user feedback on cable status
