################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (13.3.rel1)
################################################################################

# Add inputs and outputs from these tool invocations to the build variables 
C_SRCS += \
../Core/Src/wiznet/socket.c \
../Core/Src/wiznet/w5500.c \
../Core/Src/wiznet/w5500_port.c \
../Core/Src/wiznet/wizchip_conf.c 

OBJS += \
./Core/Src/wiznet/socket.o \
./Core/Src/wiznet/w5500.o \
./Core/Src/wiznet/w5500_port.o \
./Core/Src/wiznet/wizchip_conf.o 

C_DEPS += \
./Core/Src/wiznet/socket.d \
./Core/Src/wiznet/w5500.d \
./Core/Src/wiznet/w5500_port.d \
./Core/Src/wiznet/wizchip_conf.d 


# Each subdirectory must supply rules for building sources it contributes
Core/Src/wiznet/%.o Core/Src/wiznet/%.su Core/Src/wiznet/%.cyclo: ../Core/Src/wiznet/%.c Core/Src/wiznet/subdir.mk
	arm-none-eabi-gcc "$<" -mcpu=cortex-m3 -std=gnu11 -g3 -DDEBUG -DUSE_HAL_DRIVER -DSTM32F103xB -c -I../Core/Inc -I../Drivers/STM32F1xx_HAL_Driver/Inc -I../Drivers/STM32F1xx_HAL_Driver/Inc/Legacy -I../Drivers/CMSIS/Device/ST/STM32F1xx/Include -I../Drivers/CMSIS/Include -O0 -ffunction-sections -fdata-sections -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfloat-abi=soft -mthumb -o "$@"

clean: clean-Core-2f-Src-2f-wiznet

clean-Core-2f-Src-2f-wiznet:
	-$(RM) ./Core/Src/wiznet/socket.cyclo ./Core/Src/wiznet/socket.d ./Core/Src/wiznet/socket.o ./Core/Src/wiznet/socket.su ./Core/Src/wiznet/w5500.cyclo ./Core/Src/wiznet/w5500.d ./Core/Src/wiznet/w5500.o ./Core/Src/wiznet/w5500.su ./Core/Src/wiznet/w5500_port.cyclo ./Core/Src/wiznet/w5500_port.d ./Core/Src/wiznet/w5500_port.o ./Core/Src/wiznet/w5500_port.su ./Core/Src/wiznet/wizchip_conf.cyclo ./Core/Src/wiznet/wizchip_conf.d ./Core/Src/wiznet/wizchip_conf.o ./Core/Src/wiznet/wizchip_conf.su

.PHONY: clean-Core-2f-Src-2f-wiznet

