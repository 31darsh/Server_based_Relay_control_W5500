#include "main.h"
#include <string.h>
#include <stdio.h>
#include <stdbool.h>

#include "wiznet/socket.h"
#include "wiznet/wizchip_conf.h"
#include "wiznet/w5500_port.h"

#define RELAY_SOCKET 0
#define SERVER_PORT 9000
#define DEVICE_ID "relay-f105-01"

#define RX_BUF_SIZE 128
#define LINE_BUF_SIZE 64

extern SPI_HandleTypeDef hspi1;
extern UART_HandleTypeDef huart1;

/* ================= UART DEBUG ================= */

void UART_Print(char *msg)
{
    HAL_UART_Transmit(&huart1, (uint8_t*)msg, strlen(msg), 100);
}

/* ================= NETWORK ================= */

static uint8_t server_ip[4] = {192,168,31,101};

static const wiz_NetInfo netinfo = {
    .mac = {0x00,0x08,0xDC,0x11,0x22,0x33},
    .ip  = {192,168,31,50},
    .sn  = {255,255,255,0},
    .gw  = {192,168,31,1},
    .dns = {8,8,8,8},
    .dhcp = NETINFO_STATIC
};

/* ================= STATE ================= */

static char linebuf[LINE_BUF_SIZE];
static uint16_t line_len = 0;

static uint8_t relay_state = 0;
static uint32_t last_heartbeat = 0;

/* ================= HARDWARE ================= */

static void W5500_Reset(void)
{
    UART_Print("RESET LOW\r\n");

    //HAL_GPIO_WritePin(W5500_RESET_GPIO_Port, W5500_RESET_Pin, GPIO_PIN_RESET);
    HAL_Delay(200);

    UART_Print("RESET HIGH\r\n");

    HAL_GPIO_WritePin(W5500_RESET_GPIO_Port, W5500_RESET_Pin, GPIO_PIN_SET);
    HAL_Delay(500);
}

/* ================= RELAY ================= */

static void Relay_Set(uint8_t state)
{
    relay_state = state;

    HAL_GPIO_WritePin(RELAY1_GPIO_Port, RELAY1_Pin,
        state ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

/* ================= SEND ================= */

static void send_msg(const char *msg)
{
    send(RELAY_SOCKET, (uint8_t*)msg, strlen(msg));
}

static void send_hello(void)
{
    char msg[128];

    sprintf(msg,
        "{\"type\":\"hello\",\"deviceId\":\"%s\"}\n",
        DEVICE_ID);

    send_msg(msg);
}
static void send_status(void)
{
    char msg[128];

    sprintf(msg,
        "{\"type\":\"status\",\"deviceId\":\"%s\",\"relay1\":\"%s\"}\n",
        DEVICE_ID,
        relay_state ? "on" : "off");

    send_msg(msg);
}
/* ================= PARSER ================= */

static void parse_cmd(uint8_t *buf, int len)
{
    char *str = (char*)buf;

    UART_Print("RX: ");
    UART_Print(str);
    UART_Print("\r\n");

    /* CHECK TYPE */
    if(!strstr(str, "\"type\":\"command\""))
        return;

    /* CHECK ACTION */
    if(!strstr(str, "\"action\":\"relay_set\""))
        return;

    /* CHECK RELAY */
    if(!strstr(str, "\"relay\":1"))
        return;

    /* STATE */
    if(strstr(str, "\"state\":\"on\""))
    {
        UART_Print("CMD ON\r\n");

        HAL_GPIO_WritePin(RELAY1_GPIO_Port, RELAY1_Pin, GPIO_PIN_SET);
        relay_state = 1;

        send_msg("{\"type\":\"ack\",\"relay1\":\"on\"}\n");
        send_status();
    }
    else if(strstr(str, "\"state\":\"off\""))
    {
        UART_Print("CMD OFF\r\n");

        HAL_GPIO_WritePin(RELAY1_GPIO_Port, RELAY1_Pin, GPIO_PIN_RESET);
        relay_state = 0;

        send_msg("{\"type\":\"ack\",\"relay1\":\"off\"}\n");
        send_status();
    }
}
/* ================= SOCKET ================= */

static void socket_connect(void)
{
    UART_Print("SOCKET CONNECT\r\n");

    socket(RELAY_SOCKET, Sn_MR_TCP, 5000, 0);

    if(connect(RELAY_SOCKET, server_ip, SERVER_PORT) == SOCK_OK)
    {
        UART_Print("CONNECTED\r\n");
        send_hello();
        send_status();
    }
    else
    {
        UART_Print("CONNECT FAIL\r\n");
    }
}

static void socket_loop(void)
{
    uint8_t status = getSn_SR(RELAY_SOCKET);

    if(status != SOCK_ESTABLISHED)
    {
        UART_Print("RECONNECT\r\n");

        close(RELAY_SOCKET);
        HAL_Delay(1000);
        socket_connect();
        return;
    }

    uint8_t buf[RX_BUF_SIZE];
    int len = recv(RELAY_SOCKET, buf, sizeof(buf));

    if(len > 0)
    {
        parse_cmd(buf, len);
    }
}

/* ================= INIT ================= */

void App_Relay_Init(void)
{
    UART_Print("INIT START\r\n");

    /* RESET */
    W5500_Reset();

    /* SPI REGISTER */
    reg_wizchip_cs_cbfunc(W5500_Select, W5500_Unselect);
    reg_wizchip_spi_cbfunc(W5500_ReadByte, W5500_WriteByte);
    reg_wizchip_spiburst_cbfunc(W5500_ReadBurst, W5500_WriteBurst);

    UART_Print("SPI OK\r\n");

    /* CHIP RESET */
    ctlwizchip(CW_RESET_WIZCHIP, 0);
    HAL_Delay(100);

    /* MEMORY CONFIG */
    uint8_t txsize[8] = {2,2,2,2,2,2,2,2};
    uint8_t rxsize[8] = {2,2,2,2,2,2,2,2};

    wizchip_init(txsize, rxsize);

    UART_Print("W5500 INIT OK\r\n");

    /* VERSION CHECK (NOW CORRECT PLACE) */
    uint8_t version = getVERSIONR();

    char msg[40];
    sprintf(msg, "VERSION: 0x%02X\r\n", version);
    UART_Print(msg);

    /* NETWORK */
    wizchip_setnetinfo((wiz_NetInfo*)&netinfo);

    UART_Print("NET OK\r\n");

    /* PHY CHECK */
    uint8_t link = wizphy_getphylink();

    if(link == PHY_LINK_ON)
        UART_Print("LAN OK\r\n");
    else
        UART_Print("LAN FAIL\r\n");

    socket_connect();
}

/* ================= LOOP ================= */

void App_Relay_Process(void)
{
    socket_loop();

    if(HAL_GetTick() - last_heartbeat > 5000)
    {
        last_heartbeat = HAL_GetTick();
        send_msg("{\"type\":\"hb\"}\n");
    }
}
