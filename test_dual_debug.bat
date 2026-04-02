@echo off
echo STM32F103 Dual Debug Test Script
echo =================================
echo.
echo This script helps test both USB CDC and USART1 debug outputs
echo.
echo Prerequisites:
echo 1. Firmware flashed to STM32F103
echo 2. Board powered and reset
echo.
echo Testing Options:
echo.
echo 1. Test USB CDC (Virtual COM Port)
echo    - Connect USB cable
echo    - Install ST VCP drivers if needed
echo    - Find COM port in Device Manager
echo    - Use PuTTY/TeraTerm at any baud rate
echo.
echo 2. Test USART1 (Hardware UART)
echo    - Connect TTL UART adapter to PA9(TX)/PA10(RX)/GND
echo    - Use PuTTY/TeraTerm at 115200 baud, 8N1
echo.
echo 3. Test Network Connectivity
echo    - Start backend server: cd backend && node server.js
echo    - Ping test: ping 192.168.31.50
echo.
echo Expected Debug Messages:
echo -----------------------
echo W5500 raw version read: 0x04
echo W5500 library version: 0x04
echo W5500 hardware reset complete - entering init state
echo W5500 SPI callbacks registered
echo W5500 wizchip initialized
echo PHY auto-negotiation phase complete, entering stability check
echo PHY link stable - network ready for socket operations
echo Ping socket opened for ICMP responses
echo [info] application initialized
echo.
echo If you see these messages, both debug outputs are working!
echo.
pause