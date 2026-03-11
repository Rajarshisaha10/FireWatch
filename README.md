# FireWatch Pro — Hosting & Setup Guide

## Project Structure
```
firewatch/
├── server.js              ← Node.js relay server (runs on Render)
├── package.json
├── public/
│   └── index.html         ← Dashboard (served by the server)
└── firewatch_esp32.ino    ← ESP32 Arduino code
```

---

## Step 1 — Create a GitHub Repository

1. Go to https://github.com and sign in (create an account if needed)
2. Click **New repository**
3. Name it `firewatch` — set it to **Public**
4. Click **Create repository**

---

## Step 2 — Upload Files to GitHub

**Option A — GitHub web interface (easiest):**
1. Open your new repo on GitHub
2. Click **Add file → Upload files**
3. Upload: `server.js` and `package.json`
4. Create a folder called `public`: click **Add file → Create new file**, type `public/index.html`, paste the contents, commit
5. Upload `firewatch_esp32.ino` for reference

**Option B — Git command line:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/firewatch.git
git push -u origin main
```

---

## Step 3 — Deploy to Render

1. Go to https://render.com and sign in with GitHub
2. Click **New → Web Service**
3. Select your `firewatch` repository
4. Configure:
   - **Name:** `firewatch-pro` (or any name you want)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Click **Create Web Service**
6. Wait ~2 minutes for deployment
7. Your URL will be: `https://firewatch-pro.onrender.com`

> **Important:** Render free tier spins down after 15 minutes of inactivity.
> The first request after sleep takes ~30 seconds. Upgrade to a paid plan to avoid this.

---

## Step 4 — Edit the ESP32 Code

Open `firewatch_esp32.ino` and change only these 3 lines at the top:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "https://firewatch-pro.onrender.com/data";
```

Replace `firewatch-pro` with whatever name you gave your Render app.

---

## Step 5 — Flash the ESP32

1. Open Arduino IDE
2. Install required libraries (Tools → Manage Libraries):
   - `Adafruit BMP280 Library`
   - `DallasTemperature`
   - `OneWire`
   - `SparkFun MAX3010x Pulse and Proximity Sensor Library`
3. Select Board: **ESP32 Dev Module**
4. Select the correct COM port
5. Upload the sketch
6. Open Serial Monitor (115200 baud) — you should see:
   ```
   Connecting to WiFi: YOUR_NETWORK
   WiFi connected!
   IP address: 192.168.x.x
   Sending data to: https://firewatch-pro.onrender.com/data
   Skin Temp: 36.5C | Ambient Pressure: 1013.25hPa | ...
   POST OK — {"skin_temp":36.5,...}
   ```

---

## Step 6 — Open the Dashboard

1. Go to `https://firewatch-pro.onrender.com` in your browser
2. The connection panel opens automatically
3. The URL is pre-filled — click **CONNECT**
4. Data starts flowing within 2 seconds

---

## Data Flow

```
ESP32 Sensors
     |
     | HTTP POST every 2s
     | JSON: {skin_temp, pressure, bmp_temp, mq2_raw, mq7_raw, mq7_phase, ir_value}
     v
Render Server (server.js)
     |
     | WebSocket broadcast
     v
Browser Dashboard (index.html)
```

---

## JSON Fields Reference

| Field        | Source    | Description                              |
|-------------|-----------|------------------------------------------|
| skin_temp   | DS18B20   | Body/skin temperature in °C              |
| pressure    | BMP280    | Barometric pressure in hPa               |
| bmp_temp    | BMP280    | Ambient temperature in °C                |
| mq2_raw     | MQ-2      | Raw ADC (0–4095), combustible gas/smoke  |
| mq7_raw     | MQ-7      | Raw ADC, CO — only sent after 90s sample |
| mq7_phase   | State machine | "HEATING_5V" or "MEASURING_1_4V"    |
| ir_value    | MAX30102  | IR photodiode value — >5000 = contact    |

---

## MQ-7 Behaviour

The MQ-7 uses a thermal cycle:
- **60 seconds at 5V** — sensor purge/heating
- **90 seconds at 1.4V** — measurement window
- CO reading is taken at the **end** of the 90s window

Between samples, the dashboard shows the **last sampled ADC value** and the current phase.
This is normal — readings update every ~2.5 minutes.

---

## ADC Calibration

The MQ-2 and MQ-7 show raw ADC values (0–4095). The dashboard alert thresholds are:

**MQ-2 (Smoke/Gas):**
- >3200 = Critical Heavy Smoke
- >2500 = Smoke Detected
- >1500 = Gas Elevated
- >800  = Low Level Detected

**MQ-7 (CO):**
- >3000 = Critical High CO
- >2000 = Warning Elevated
- >1200 = Caution Detectable

These are conservative defaults. Calibrate against a known gas source and adjust the
`classifyMQ7()` and `classifyMQ2()` functions in `index.html`.

---

## Health Check

Visit `https://your-app.onrender.com/health` to see:
```json
{
  "status": "ok",
  "clients": 1,
  "lastReceived": "3s ago"
}
```
