# Joy-Con WebHID setup

Open Bistimulation can drive optional tactile output from the participant browser through WebHID. The Joy-Con devices and rumble commands stay local to the participant computer; Supabase only carries session state and realtime control messages.

## Requirements

- Chrome or Microsoft Edge with WebHID support.
- HTTPS or `localhost` for local development.
- Left and right Nintendo Joy-Con paired over Bluetooth with the participant computer.
- The participant tab must stay open and awake while tactile output is enabled.

## Participant setup

1. Pair both Joy-Cons in the operating system Bluetooth settings.
2. Open the participant link from the controller panel.
3. Enable tactile output in the controller panel if it is not already enabled.
4. In the participant tactile panel, press `Add Joy-Cons`.
5. Select both Joy-Cons from the browser device prompt. Some browsers ask for one controller at a time; repeat `Add Joy-Cons` if only one side appears.
6. Confirm that the panel shows the left and right Joy-Con as connected.
7. Run `Test left`, `Test right`, and `Test both` before starting a round.

## During a round

- Keep the participant tab visible and avoid locking the computer.
- Tactile pulses follow the same left/right motion clock as the visual stimulus.
- If only one side vibrates, stop the round, test both sides, and re-add the missing Joy-Con from the participant panel.
- If the participant closes or leaves the page, the controller panel should move back to `No participant` as soon as realtime presence or the disconnect message is received.

## Troubleshooting

### WebHID is unavailable

Use Chrome or Edge, and open the app over HTTPS or `localhost`. WebHID is not available in all browsers.

### Only one Joy-Con appears

Pair both controllers in Bluetooth settings first. Then press `Add Joy-Cons` again and approve the missing side in the browser prompt.

### Rumble stops during fast rounds

Reduce pulse duration or speed, then test both sides again. The app now tracks left and right Joy-Con pulse timing independently so the opposite side can fire even while the previous side is finishing.

### Both controllers remain active after stopping

Use `Disconnect Joy-Cons` or close the participant tab. The app sends a neutral rumble command when tactile output stops.
