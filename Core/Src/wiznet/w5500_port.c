#include "wiznet/w5500_port.h"
#include "main.h"


extern SPI_HandleTypeDef hspi1;

/* ====== CHIP SELECT ====== */

void W5500_Select(void)
{
    // Disable other SPI devices if they exist (like RC522)
    // HAL_GPIO_WritePin(RC522_CS_GPIO_Port, RC522_CS_Pin, GPIO_PIN_SET); // disable RC522 if present
    HAL_GPIO_WritePin(W5500_CS_GPIO_Port, W5500_CS_Pin, GPIO_PIN_RESET);
}

void W5500_Unselect(void)
{
    HAL_GPIO_WritePin(W5500_CS_GPIO_Port, W5500_CS_Pin, GPIO_PIN_SET);
}

/* ====== SPI BYTE ====== */

uint8_t W5500_ReadByte(void)
{
    uint8_t tx = 0xFF;
    uint8_t rx = 0;

    HAL_SPI_TransmitReceive(&hspi1, &tx, &rx, 1, HAL_MAX_DELAY);
    return rx;
}

void W5500_WriteByte(uint8_t byte)
{
    HAL_SPI_Transmit(&hspi1, &byte, 1, HAL_MAX_DELAY);
}

/* ====== SPI BURST ====== */

void W5500_ReadBurst(uint8_t *buf, uint16_t len)
{
    HAL_SPI_TransmitReceive(&hspi1, buf, buf, len, HAL_MAX_DELAY);
}

void W5500_WriteBurst(uint8_t *buf, uint16_t len)
{
    HAL_SPI_Transmit(&hspi1, buf, len, HAL_MAX_DELAY);
}
