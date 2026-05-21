# Local Joy-Con Bridge

Open Bistimulation can run in a hosted browser, but Joy-Con HID access is native and local. The Vercel app calls a small Node bridge running on the therapist/operator computer instead of importing `node-hid` in frontend code.

The bridge lives in `scripts/`, uses `node-hid`, and talks to official Nintendo Joy-Con controllers over Bluetooth. It is a local companion process only; it is not deployed to Vercel. Visual and audio cues continue to work in the browser without the bridge.

This is experimental software. It is not medical advice, not a medical device, and does not provide clinical or safety guarantees. The operator remains responsible for deciding whether and how to use optional tactile output.

## Setup

Requirements:

- Node.js `>=20 <23`
- npm `>=10`
- Official Nintendo Joy-Con left and right controllers paired over Bluetooth

Install dependencies from the repository root:

```sh
npm install
```

`node-hid` is listed in `optionalDependencies` because it is only needed by the local Node bridge and CLI. The Vite frontend build does not import it.

## Hardware IDs

Official Nintendo Switch Joy-Con devices use:

```txt
vendorId  0x057e  Nintendo
productId 0x2006  Joy-Con Left
productId 0x2007  Joy-Con Right
```

In `node-hid`, paired Bluetooth Joy-Con can appear as `Wireless Gamepad`. The product IDs are the reliable side identifiers.

## Pairing

1. Open your operating system Bluetooth settings.
2. Hold the small sync button on the Joy-Con rail until the LEDs begin cycling.
3. Pair each Joy-Con separately.
4. Keep the controllers awake while testing. Press a face button if they disappear.
5. Close other apps that may be holding the same HID device.

## Run The Bridge

```sh
npm run joycon:bridge
```

Defaults:

```txt
JOYCON_BRIDGE_HOST=127.0.0.1
JOYCON_BRIDGE_PORT=5174
JOYCON_ALLOWED_ORIGINS=http://localhost:5173,https://open-bistimulation.vercel.app
```

Override the defaults when needed:

```sh
JOYCON_BRIDGE_PORT=5174 \
JOYCON_ALLOWED_ORIGINS=http://localhost:5173,https://open-bistimulation.vercel.app \
npm run joycon:bridge
```

The CORS allowlist is explicit. The bridge does not use wildcard CORS by default.

These variables are for the local bridge process, not the Vercel frontend runtime.

## Check Status

```sh
curl http://127.0.0.1:5174/api/joycon/status
```

Expected shape:

```json
{
  "ok": true,
  "mode": "node-hid",
  "bridgeVersion": "0.1.0",
  "endpoints": [
    "/api/joycon/status",
    "/api/joycon/devices",
    "/api/joycon/pulse",
    "/api/joycon/neutral"
  ]
}
```

## Check Devices

```sh
npm run joycon:list
```

The same data is available through the bridge:

```sh
curl http://127.0.0.1:5174/api/joycon/devices
```

Look for one left Joy-Con and one right Joy-Con. On some systems the product name may be `Wireless Gamepad`; use `productId 0x2006` for left and `productId 0x2007` for right.

## Test Left, Right, Both, And Neutral

```sh
npm run joycon:left
npm run joycon:right
npm run joycon:both
npm run joycon:neutral
```

Custom CLI examples:

```sh
node scripts/joycon-rumble.mjs pulse --side left --intensity high --duration 800 --repeats 2
node scripts/joycon-rumble.mjs pulse --side both --intensity medium --duration 700
node scripts/joycon-rumble.mjs neutral --side both
```

HTTP examples:

```sh
curl -X POST http://127.0.0.1:5174/api/joycon/pulse \
  -H 'Content-Type: application/json' \
  -d '{"side":"left","intensity":"high","duration":450,"repeats":1}'
```

```sh
curl -X POST http://127.0.0.1:5174/api/joycon/neutral \
  -H 'Content-Type: application/json' \
  -d '{"side":"both"}'
```

The bridge validates request bodies and accepts only:

```txt
side:      left | right | both
intensity: low | medium | high
duration:  20..5000 ms
repeats:   1..20
```

The browser API intentionally rejects `path` and `packetBytes`. The CLI has `--path` for local debugging when you deliberately choose a path from `npm run joycon:list`; do not expose arbitrary HID paths to hosted browser callers.

## Open The App

1. Start the bridge on the therapist/operator computer:

```sh
npm run joycon:bridge
```

2. Open the hosted Vercel app or the local dev app in the controller browser.
3. Open the therapist/controller UI.
4. In the tactile panel, set `Local bridge URL` to the bridge address, usually:

```txt
http://127.0.0.1:5174
```

5. Confirm the tactile panel shows `Bridge connected`.
6. Enable tactile output only after the left and right Joy-Con rows are detected.

## Packet Length

The default Joy-Con output packet length is `49` bytes, including the report ID at byte `0`. If vibration does not work on a particular platform or adapter, test `64` from the CLI:

```sh
node scripts/joycon-rumble.mjs pulse --side left --intensity high --duration 450 --packet-bytes 64
```

Keep browser calls on the default bridge contract unless there is a specific local reason to add a guarded option.

## Troubleshooting

- No devices visible: confirm each Joy-Con is paired over Bluetooth, awake, and not connected to another device.
- Wrong side or unknown side: official Joy-Con are detected by product IDs `0x2006` and `0x2007`; clone controllers may not use the same IDs or rumble protocol.
- Permission errors on Linux: HID devices may need a udev rule or elevated permissions for your user to access Nintendo HID devices.
- macOS privacy prompts: allow the terminal or shell app to access input/Bluetooth devices if macOS asks.
- Windows shows `Wireless Gamepad`: that can be normal; check `productId` in `npm run joycon:list`.
- Vibration does not stop: run `npm run joycon:neutral`. The pulse implementation also sends neutral frames after each pulse and closes devices in `finally` blocks.
- Bridge CORS failure: add the frontend origin to `JOYCON_ALLOWED_ORIGINS`. Include the full scheme, host, and port.
- Hosted build concerns: the native dependency is optional and isolated to `scripts/`; `npm run build` for Vite does not import `node-hid`.
- App shows `Bridge offline`: confirm `npm run joycon:bridge` is still running, the `Local bridge URL` matches the host and port, and the app origin is included in `JOYCON_ALLOWED_ORIGINS`.
- Pulse request times out: check that both Joy-Cons are awake, then run `npm run joycon:neutral` before testing again.

## Manual Verification Checklist

- [ ] `npm run joycon:list` shows left and right Joy-Con.
- [ ] `npm run joycon:left` vibrates only left.
- [ ] `npm run joycon:right` vibrates only right.
- [ ] `npm run joycon:both` vibrates both.
- [ ] `npm run joycon:neutral` stops rumble.
- [ ] Therapist UI shows bridge connected.
- [ ] Tactile enabled + running session alternates left/right.
- [ ] Pause/stop sends neutral.
- [ ] Visual/audio still work with bridge offline.
