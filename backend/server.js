const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const crypto = require("crypto");

//const HTTP_PORT = Number(process.env.HTTP_PORT || 8080);
//const DEVICE_PORT = Number(process.env.DEVICE_PORT || 9000);
const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const DEVICES_FILE = path.join(DATA_DIR, "devices.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

const sessions = new Map();
const deviceSockets = new Map();

bootstrapStorage();
const state = {
  users: readJson(USERS_FILE),
  devices: readJson(DEVICES_FILE),
  logs: readJson(LOGS_FILE)
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(res, url);
  } catch (error) {
    sendJson(res, 500, { error: "internal_error", message: error.message });
  }
});

const tcpServer = net.createServer((socket) => {
  socket.setEncoding("utf8");
  socket.buffer = "";
  socket.deviceId = null;

  socket.on("data", (chunk) => {
    socket.buffer += chunk;
    let index = socket.buffer.indexOf("\n");
    while (index >= 0) {
      const line = socket.buffer.slice(0, index).trim();
      socket.buffer = socket.buffer.slice(index + 1);
      if (line) {
        handleDeviceMessage(socket, line);
      }
      index = socket.buffer.indexOf("\n");
    }
  });

  socket.on("close", () => {
    if (!socket.deviceId) {
      return;
    }
    const device = ensureDevice(socket.deviceId);
    device.online = false;
    device.lastSeen = new Date().toISOString();
    saveDevices();
    deviceSockets.delete(socket.deviceId);
    appendLog(socket.deviceId, "warn", "device disconnected");
  });

  socket.on("error", () => {
    socket.destroy();
  });
});

/*server.listen(HTTP_PORT, () => {
  console.log(`HTTP dashboard running on http://localhost:${HTTP_PORT}`);
});

tcpServer.listen(DEVICE_PORT, () => {
  console.log(`Device TCP listener running on port ${DEVICE_PORT}`);
});*/
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
function bootstrapStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    const adminPassword = hashPassword("admin123");
    fs.writeFileSync(
      USERS_FILE,
      JSON.stringify(
        [
          {
            id: "admin",
            username: "admin",
            displayName: "Administrator",
            role: "admin",
            passwordHash: adminPassword.hash,
            salt: adminPassword.salt,
            email: "admin@example.com"
          }
        ],
        null,
        2
      )
    );
  }

  if (!fs.existsSync(DEVICES_FILE)) {
    fs.writeFileSync(DEVICES_FILE, "[]");
  }

  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, "[]");
  }
}

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const user = state.users.find((entry) => entry.username === body.username);
    if (!user || !verifyPassword(body.password || "", user.salt, user.passwordHash)) {
      sendJson(res, 401, { error: "invalid_credentials" });
      return;
    }

    const token = crypto.randomUUID();
    sessions.set(token, user.id);
    sendJson(res, 200, { token, user: sanitizeUser(user) });
    return;
  }

  const user = authenticate(req);
  if (!user) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    sessions.delete(getBearerToken(req));
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/overview") {
    const onlineDevices = state.devices.filter((device) => device.online).length;
    const offlineDevices = state.devices.length - onlineDevices;
    const relayOnCount = state.devices.filter((device) => device.relay1 === "on").length;
    sendJson(res, 200, {
      summary: {
        totalDevices: state.devices.length,
        onlineDevices,
        offlineDevices,
        relayOnCount,
        totalLogs: state.logs.length
      },
      recentLogs: state.logs.slice(-10).reverse()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/devices") {
    sendJson(res, 200, { devices: state.devices });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/devices/") && url.pathname.endsWith("/logs")) {
    const deviceId = decodeURIComponent(url.pathname.split("/")[3] || "");
    const limit = Number(url.searchParams.get("limit") || "50");
    const logs = state.logs.filter((entry) => entry.deviceId === deviceId).slice(-limit).reverse();
    sendJson(res, 200, { logs });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/devices/")) {
    const deviceId = decodeURIComponent(url.pathname.split("/")[3] || "");
    const device = state.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      sendJson(res, 404, { error: "device_not_found" });
      return;
    }
    sendJson(res, 200, { device });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/devices/") && url.pathname.endsWith("/control")) {
    const deviceId = decodeURIComponent(url.pathname.split("/")[3] || "");
    const body = await readBody(req);
    const device = state.devices.find((entry) => entry.id === deviceId);
    const deviceSocket = deviceSockets.get(deviceId);
    if (!device || !deviceSocket || !device.online) {
      sendJson(res, 409, { error: "device_offline" });
      return;
    }

    const desiredState = body.state === "on" ? "on" : "off";
    const payload = {
      type: "command",
      action: "relay_set",
      relay: 1,
      state: desiredState,
      requestId: crypto.randomUUID()
    };

    deviceSocket.write(`${JSON.stringify(payload)}\n`);
    appendLog(deviceId, "info", `dashboard requested relay ${desiredState}`);
    sendJson(res, 200, { ok: true, request: payload });
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/profile") {
    const body = await readBody(req);
    user.displayName = body.displayName || user.displayName;
    user.email = body.email || user.email;

    if (body.newPassword) {
      const nextPassword = hashPassword(body.newPassword);
      user.passwordHash = nextPassword.hash;
      user.salt = nextPassword.salt;
    }

    saveUsers();
    sendJson(res, 200, { user: sanitizeUser(user) });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

function serveStatic(res, url) {
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const filePath = path.resolve(FRONTEND_DIR, requested);

  if (!filePath.startsWith(FRONTEND_DIR)) {
    sendText(res, 403, "Forbidden", "text/plain");
    return;
  }

  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      fs.readFile(path.join(FRONTEND_DIR, "index.html"), (fallbackError, fallbackBuffer) => {
        if (fallbackError) {
          sendText(res, 404, "Not found", "text/plain");
          return;
        }
        sendText(res, 200, fallbackBuffer, "text/html; charset=utf-8");
      });
      return;
    }

    sendText(res, 200, buffer, contentType(filePath));
  });
}

function handleDeviceMessage(socket, line) {
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    appendLog(socket.deviceId || "unknown", "error", `invalid json: ${line}`);
    return;
  }

  const deviceId = payload.deviceId || socket.deviceId || "unknown";
  const device = ensureDevice(deviceId);
  socket.deviceId = deviceId;
  deviceSockets.set(deviceId, socket);

  device.online = true;
  device.lastSeen = new Date().toISOString();
  device.ip = payload.ip || device.ip || socket.remoteAddress;
  device.firmware = payload.firmware || device.firmware || "n/a";
  device.link = payload.link || device.link || "up";
  device.relay1 = payload.relay1 || device.relay1 || "off";
  device.uptimeMs = payload.uptimeMs || device.uptimeMs || 0;

  if (payload.type === "hello") {
    device.name = device.name || deviceId;
    appendLog(deviceId, "info", `device connected from ${device.ip}`);
  }

  if (payload.type === "ack") {
    appendLog(deviceId, "info", `relay acknowledged as ${device.relay1}`);
  }

  if (payload.type === "log") {
    appendLog(deviceId, payload.level || "info", payload.message || "log message");
  }

  saveDevices();
}

function ensureDevice(deviceId) {
  let device = state.devices.find((entry) => entry.id === deviceId);
  if (!device) {
    device = {
      id: deviceId,
      name: deviceId,
      online: false,
      relay1: "off",
      link: "unknown",
      firmware: "n/a",
      ip: "",
      lastSeen: null,
      uptimeMs: 0
    };
    state.devices.push(device);
    saveDevices();
  }
  return device;
}

function appendLog(deviceId, level, message) {
  state.logs.push({
    id: crypto.randomUUID(),
    deviceId,
    level,
    message,
    timestamp: new Date().toISOString()
  });

  if (state.logs.length > 5000) {
    state.logs.splice(0, state.logs.length - 5000);
  }

  saveLogs();
}

function authenticate(req) {
  const token = getBearerToken(req);
  const userId = token ? sessions.get(token) : null;
  return state.users.find((entry) => entry.id === userId) || null;
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  return "text/html; charset=utf-8";
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  sendText(res, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function sendText(res, statusCode, payload, type) {
  res.writeHead(statusCode, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(state.users, null, 2));
}

function saveDevices() {
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(state.devices, null, 2));
}

function saveLogs() {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(state.logs, null, 2));
}



