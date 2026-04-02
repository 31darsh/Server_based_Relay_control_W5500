/*
 * w5500_port.h
 *
 *  Created on: 11-Feb-2026
 *      Author: Darshan
 */

#ifndef W5500_PORT_H
#define W5500_PORT_H

#include <stdint.h>

void W5500_Select(void);
void W5500_Unselect(void);

uint8_t W5500_ReadByte(void);
void W5500_WriteByte(uint8_t byte);

void W5500_ReadBurst(uint8_t *buf, uint16_t len);
void W5500_WriteBurst(uint8_t *buf, uint16_t len);

#endif
