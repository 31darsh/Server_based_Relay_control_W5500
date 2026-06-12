# Dual Debug Output Setup (USB CDC + USART1)
## Overview
The firmware now outputs debug information to both USB CDC (Virtual COM Port) and USART1 (Serial) simultaneously.

## Hardware Configuration
- **USB CDC**: Uses STM32 USB peripheral for virtual COM port
- **USART1**: Hardware UART on PA9 (TX) / PA10 (RX) at 115200 baud, 8N1

## Debug Output Methods

### 1. USB CDC (Virtual COM Port)
- **Connection**: USB cable to PC
- **Driver**: ST VCP drivers required
- **COM Port**: Appears as COMx in Device Manager
- **Tool**: PuTTY, Tera Term, or Arduino IDE Serial Monitor
- **Baud Rate**: N/A (USB speed)

### 2. USART1 (Hardware UART)
- **Connection**: TTL UART to USB adapter (FTDI, CP2102, etc.)
- **Pins**: PA9 (TX), PA10 (RX), GND
- **Baud Rate**: 115200
- **Data Format**: 8 bits, No parity, 1 stop bit
- **Tool**: PuTTY, Tera Term, or any serial terminal

## Expected Debug Output
When the board starts, you should see:
```
W5500 raw version read: 0x04
W5500 library version: 0x04
W5500 hardware reset complete - entering init state
W5500 SPI callbacks registered
W5500 wizchip initialized
PHY auto-negotiation phase complete, entering stability check
PHY link stable - network ready for socket operations
Ping socket opened for ICMP responses
[info] application initialized
```

## Testing Instructions

### Option A: USB CDC Only
1. Connect board via USB
2. Install ST VCP drivers if needed
3. Open serial terminal to COMx port
4. Reset board - debug messages should appear

### Option B: USART1 Only
1. Connect TTL UART adapter to PA9/PA10/GND
2. Open serial terminal at 115200 baud
3. Reset board - debug messages should appear

### Option C: Both Simultaneously
1. Connect both USB and UART
2. Open two serial terminals
3. Reset board - messages appear in both terminals

## Troubleshooting

### USB Not Detected
- Check USB cable (data cable, not power-only)
- Try different USB port
- Install ST VCP drivers from ST website
- Check Device Manager for "Unknown USB Device"

### No USART1 Output
- Verify UART adapter connections (TX→RX, RX→TX)
- Check baud rate (115200)
- Verify PA9/PA10 pins are not used by other peripherals
- Check UART adapter voltage (3.3V for STM32F103)

### No Debug Output
- Verify firmware flashed correctly
- Check board power and reset
- Try different serial terminal software
- Check for buffer overflow (messages > 192 chars truncated)

## Firmware Changes
- Modified `Debug_Log()` function in `app_relay.c`
- Added `HAL_UART_Transmit()` calls alongside `CDC_Transmit_FS()`
- Added `UART_HandleTypeDef huart1` extern declaration

## Build Status
✅ Firmware compiled successfully
- ELF: Server_based_Relay_controll.elf (952,452 bytes)
- HEX: Server_based_Relay_controll.hex (131,114 bytes)