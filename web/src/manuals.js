export const manuals = [
 {id:'start',title:'Getting started',path:'/docs',intro:'Connect a device, try a control, then make the workspace your own.',steps:[
 'Create an account with your name, email and a password of at least 12 characters. If you already have an account, log in.',
 'Open Devices and register an ESP32 or Laptop simulator. Save its generated device token privately.',
 'For hardware, use your existing MQTT firmware with the laptop LAN IP, device UUID and token. For a laptop simulator, download Simulator config, place .device.env beside package.json, and run npm run simulate in a second terminal.',
 'Keep PostgreSQL and npm run dev running. Wait for Online, open the device, then wait for Live updates connected.',
 'Try Power ON/OFF and brightness. Wait for Device confirmed before sending another command.',
 'Add widgets under My dashboard. Use Automations for a clock time, Scenes for a manual multi-action button, and Sensor rules for a threshold crossing.'
 ],example:'Your existing Light ESP32 uses V0 for dummy temperature, V1 for power, and V2 for brightness. No new firmware is needed to use these pins with Milestone 5.',notes:[
 'V0 in the demo is simulated temperature, not a physical sensor measurement.',
 'Google/Alexa integration, email verification and password recovery are not included yet.',
 'Use a separate registered device/token for each physical board or simulator.'
 ],trouble:[['No board available','Choose Laptop simulator. Start the API first, then run npm run simulate with that simulator’s token.'],['Where is each manual?','Use How to use in the top bar of any dashboard tab, or select a topic here. Search finds instructions across all topics.']]},
 {id:'devices',title:'Devices',path:'/dashboard',intro:'Register devices and manage their identity, access and connection status.',steps:[
 'Click Add device (or Add your first device). Enter a recognizable name and select the device type, then click Create device.',
 'Copy the generated token into your firmware/configuration. For the simulator, download Simulator config and save it as .device.env in the project root.',
 'Start the ESP32 or simulator. A valid heartbeat marks it Online; after about 30 seconds without a heartbeat it becomes Offline.',
 'Click the device name to open its controls. Use the rename action to change its display name.',
 'To recover a token, click the masked token/manage-token control and confirm your account password. Rotate only when you intend to replace the credential.',
 'Disable blocks communication until you enable the device again. Delete permanently removes the device and related pin data; read the confirmation carefully.'
 ],example:'Name your board Living room ESP32 and register the laptop simulator separately as Test simulator.',notes:[
 'Rotating a token invalidates the old one. Update firmware or .device.env and reconnect. Review and save affected schedules, scenes and rules.',
 'Tokens are secrets. Do not include them in screenshots, shared code or support logs. Preserve your server TOKEN_ENCRYPTION_KEY.',
 'On local HTTP, clipboard access may be unavailable. Select the revealed token and copy it manually if the Copy button fails.'
 ],trouble:[['Device remains offline','Check power, Wi-Fi, laptop LAN IP, MQTT port 1883, the private-network firewall, token and device UUID. Look at Serial Monitor at 115200 baud.'],['Authentication fails after rotation','Update the stored token in the correct device client and restart it. Do not run two clients with the same device identity.']]},
 {id:'control',title:'Device controls',path:'/dashboard',intro:'Read a device’s virtual pins and send commands with acknowledgement.',steps:[
 'Open Devices and click a device name. Check Online and Live updates connected before sending a command.',
 'Read V0 temperature and its history. Values and timestamps show the latest reported data.',
 'For V1 Power, click ON or OFF once and wait for Device confirmed.',
 'For V2 Brightness, move the slider and click Apply brightness. Wait for confirmation before sending another value.',
 'Use Add virtual pin when your firmware implements that channel. Choose an unused V0–V31 pin, label, type, direction, bounds and optional unit. Boolean + Output creates an ON/OFF switch.',
 'Use Edit on any device control, including Temperature, Power and Brightness. Change the label or unit directly; changing pin number, type, direction or range requires the reset confirmation.',
 'Use Remove on a control and confirm to delete that pin and its stored data. You can remove all three demo pins and add your own controls. This does not switch the physical appliance off.'
 ],example:'Set V2 to 40% and apply it, then set V1 ON. The current demo controls the board LED, not a mains appliance.',notes:[
 'Input pins report readings. Output pins receive desired values. Boolean means ON/OFF; Number means a numeric value.',
 'Adding or editing a virtual pin does not change ESP32 GPIO behavior. Update firmware to use the same pins, types and directions.',
 'A configuration reset clears reported state and readings, cancels pending commands, removes that pin’s dashboard widgets and disconnects the device voice mapping if it references the pin. Renumbering or removing a pin also deletes its command history. Label/unit-only edits preserve state and bindings.',
 'Edit or remove schedules, scenes and sensor rules that reference a pin before repurposing or removing it. Pausing an automation alone does not release its reference. The error lists the affected items.',
 'Recreate removed widgets and voice mappings when needed, then resync or relink Google Home/Alexa. A new virtual pin does not create another voice endpoint automatically.',
 'Telemetry for absent pins is ignored so a deleted demo sensor cannot block other command acknowledgements. Existing pins still enforce input direction, value type and range. Update firmware before repurposing V0 as an output.',
 'A pending command expires after about 15 seconds. Confirmed means firmware acknowledged the value, not an independent physical measurement.',
 'Reported values may remain visible while offline. Check the timestamp; a remembered value is not proof of current output state.'
 ],trouble:[['Reconnecting live updates','Open the exact URL in APP_ORIGIN. Check the backend and browser WebSocket error. Reload or sign in again if the session expired.'],['Waiting for device confirmation','Wait for expiry rather than clicking repeatedly. Check ESP32 Serial Monitor for Applied V1/V2 and inspect API errors. Make sure a simulator is not sharing the board token.'],['LED changes but the value does not','Inspect acknowledgements in the Serial Monitor/server logs. Do not rotate the token or reset the database as a first troubleshooting step.']]},
 {id:'builder',title:'My dashboard',path:'/dashboard/builder',intro:'Build a saved dashboard with widgets connected to your virtual pins.',steps:[
 'Click Add your first widget, or Edit dashboard then Add widget.',
 'Choose the widget type, device and compatible virtual pin. Set the label, colour and unit. For numeric widgets, configure the range and slider step as offered.',
 'Drag a widget using its handle and resize it using its corner. Widget settings also contain Keyboard layout settings for column, row, width and height.',
 'Use Phone preview to arrange the small-screen layout, then Desktop preview to review the large-screen layout.',
 'Click Save dashboard before changing tabs or closing the page. Controls become usable when you leave edit mode by saving.',
 'To change or remove a widget, return to Edit dashboard, use its edit/remove control, then save again.'
 ],example:'Add a Switch for Light V1, a Slider for V2 with 0–100 and step 1, and a Gauge or Chart for V0.',notes:[
 'Switch: boolean output. Slider: numeric output. Gauge: numeric value. Value: reported boolean or number. Chart: numeric input history.',
 'Up to 24 widgets using up to 5 distinct devices. Desktop and phone layouts are saved separately.',
 'Save before navigating to another tab; unsaved layout edits can be lost. A version conflict means another browser saved changes—reload before editing again.',
 'Charts show up to 120 recent samples and refresh about every 15 seconds; raw telemetry retention is 24 hours. They are not long-term archives.'
 ],trouble:[['A pin is missing from the widget selector','The selected widget accepts only compatible types/directions. Check the pin on the device page.'],['Controls are disabled','Save and exit edit mode. Then check device status, live connection, and whether a command is already pending.'],['Widget content is clipped','Increase the widget height or width in edit mode and save. Check both desktop and phone layouts.']]},
 {id:'automations',title:'Automations',path:'/dashboard/automations',intro:'Send an output command at a chosen date, time or repeating schedule.',steps:[
 'Choose Create automation (or Create your first automation). Give it a descriptive name.',
 'Select a device and output pin. Choose ON/OFF for a boolean pin or enter a numeric value within the pin range.',
 'Choose Once, Daily or selected weekdays. Set a future date/time for Once, or the time and repeat days for recurring schedules.',
 'Set the timezone. Use Asia/Kolkata for India. Confirm Enable this automation is selected, then save.',
 'Check the next scheduled occurrence. Keep the laptop awake with PostgreSQL and the backend running; the browser may be closed.',
 'Use Pause/Enable, Edit or Delete on the automation card. Check Run history after execution for the actual outcome.'
 ],example:'Create Evening ON: Light V1 ON daily at 18:00, Asia/Kolkata. Create a separate Night OFF: V1 OFF daily at 22:00.',notes:[
 'One automation sends one output value. Use two automations for an ON time and an OFF time.',
 'Offline/disabled devices and busy pins are skipped. Runs more than 60 seconds late are skipped, not replayed when the laptop wakes.',
 'A one-time automation becomes inactive after its attempt. Recurring schedules keep their next normal occurrence.',
 'Editing, pausing or deleting cancels pending commands for that schedule. Already-received commands cannot be recalled. Token rotation requires reviewing and saving the automation.'
 ],trouble:[['The time looks wrong','Check the automation timezone, next occurrence, and laptop clock. The scheduler interprets the chosen timezone, not just the phone display time.'],['A run was skipped','Read the run detail. Common reasons are offline device, busy pin, disabled/rotated credential or more than one minute of delay.'],['Queued but not confirmed','Inspect device connectivity/Serial Monitor. Queued is not proof that the command was applied.']]},
 {id:'groups',title:'Rooms & groups',path:'/dashboard/groups',intro:'Organize devices by location or purpose without changing their controls.',steps:[
 'Click Add room / group and enter a name.',
 'Choose Room for a location such as Living room, or Group for a collection such as Upstairs lights.',
 'Tick the devices to include and click Save.',
 'Click a member device to open its controls.',
 'Use Edit to rename the collection, change its type or update membership. Delete removes the collection only.'
 ],example:'Put Light in the room Living room and also in the group Evening lighting. A device can belong to multiple collections.',notes:[
 'Rooms/groups are organization labels, not access-sharing permissions or automatic group-control buttons. Use a Scene to command several outputs.',
 'Up to 50 collections per account and 100 device members per collection.',
 'If a member device has been deleted, edit the collection and use Remove deleted devices. Deleting the collection does not delete its devices.'
 ],trouble:[['My device is not listed','Only devices belonging to the signed-in account are shown. Register it under Devices first.'],['How do I turn the entire room on?','Create a Scene with an ON action for each relevant output. Group membership itself does not create actions.']]},
 {id:'scenes',title:'Scenes',path:'/dashboard/scenes',intro:'Send several desired output values with one manual button.',steps:[
 'Click Add scene and enter a name such as Evening.',
 'Click Add action, choose an output and set its value. Repeat for other outputs; each output may appear only once.',
 'Click Save. The card lists the actions that will be requested.',
 'Click Run scene once. Inspect Recent activity for the status of every action.',
 'Use Edit for future changes or Delete to remove the scene. Deleting also cancels its still-pending commands.'
 ],example:'Evening scene: Light V1 ON plus Light V2 = 40. A separate All off scene can set V1 OFF on several registered devices.',notes:[
 'Up to 100 scenes, each with up to 12 distinct output actions. Actions run independently, not simultaneously or as an all-or-nothing physical operation.',
 'An offline, busy, disabled, missing or credential-changed target is skipped while other actions may succeed. Edit and save after token changes.',
 'Editing a scene affects future runs. Commands already sent to a device cannot be recalled.',
 'Recent activity shows the latest 50 combined scene/rule runs filtered to this tab. History is retained for 30 days.'
 ],trouble:[['Some actions succeeded and others did not','This is a partial result. Read each action’s detail and resolve the offline/busy/credential issue before running again.'],['Duplicate output validation error','Use only one action for a given device and pin within the same scene.'],['I want this scene to run at a time','This milestone schedules individual output actions under Automations; it does not offer scheduled scene execution.']]},
 {id:'rules',title:'Sensor rules',path:'/dashboard/rules',intro:'Trigger output actions when a fresh numeric input crosses a threshold.',steps:[
 'Click Add rule, enter a name and select a numeric input sensor.',
 'Choose Above or Below and enter the threshold in the sensor’s units.',
 'Set Reset margin and Cooldown in seconds. Margin defines the reset side; cooldown limits how often crossings can run.',
 'Add one or more output actions. Leave Enabled selected and click Save.',
 'Wait for a new reading on the reset side, then a later reading beyond the trigger threshold. Check Armed/Waiting for reset reading and Recent activity.',
 'Use Pause/Enable or Edit as needed. Saving or enabling disarms the rule, so it must see the reset side again. Delete removes it and cancels its pending commands.'
 ],example:'Above 25, reset margin 1, cooldown 60: a reading at 24 or below arms the rule; a later reading above 25 triggers V1 ON. For OFF, create a separate Below 23 rule with margin 1: it arms at 24 or above and triggers below 23.',notes:[
 'Above triggers strictly greater than the threshold; Below triggers strictly less. Above resets at or below threshold minus margin; Below resets at or above threshold plus margin.',
 'Already beyond the threshold when saved? Nothing fires yet. Saving, enabling, editing and server restart disarm the rule to avoid replaying old conditions.',
 'Readings older than 30 seconds disarm rules. The worker checks latest readings about once a second and may miss very fast transitions.',
 'Every crossing is consumed, even during cooldown or when an output is skipped. It must reset and cross again; continuously high values do not repeatedly fire.',
 'The ESP32 demo V0 is simulated temperature. Test thresholds with it before connecting real sensors. Avoid opposing rules or schedules that fight over the same output.',
 'Source credential rotation/disable disables its rule. After repairing the source, edit/save and enable it. Target credential changes skip actions until the routine is edited and saved.',
 'Up to 100 rules, 12 distinct output actions each; cooldown 10–86400 seconds. These are ordinary automation rules, not safety interlocks.'
 ],trouble:[['Waiting for reset reading','For Above 25 with margin 1, wait for 24 or less first. For Below 23 with margin 1, wait for 24 or more. Your demo waveform may take a minute or two.'],['The sensor crossed but no action ran','Check enabled status, fresh readings, cooldown and whether a reset occurred. A crossing during cooldown is skipped and requires a new reset/crossing.'],['Rule ran but the light did not change','Read the action history. Queued, skipped and confirmed mean different things; check the target’s connection and firmware.']]},
 {id:'account',title:'My account',path:'/dashboard/account',intro:'Manage your profile, password and browser sessions.',steps:[
 'Edit Full name and click Save profile. Your email is displayed but cannot be changed in this milestone.',
 'To change your password, enter the current password, the new password and confirmation, then click Update password.',
 'Use Sign out everywhere to end all browser sessions, including this one. Log in again when needed.',
 'Use the sidebar Log out control to end only the current session.',
 'Delete account is permanent: it removes the account, devices and associated records. Back up anything you need before considering this action.'
 ],example:'After using a shared computer, use Sign out everywhere from your own device, then sign back in.',notes:[
 'Passwords require at least 12 characters and at most 72 UTF-8 bytes. Some non-ASCII characters use several bytes.',
 'Password changes sign out other browser sessions. Browser session controls do not replace or rotate device tokens.',
 'Email change, email verification and password-reset email flows are not available. Keep your password and private backups safe.'
 ],trouble:[['New passwords do not match','Re-enter the same new password in both fields.'],['Save password fails despite enough characters','Check the current password and the 72-byte UTF-8 maximum, especially if using emoji or non-ASCII characters.']]},
 {id:'support',title:'Connection & status guide',path:'/dashboard',intro:'Understand what the app is reporting and troubleshoot without losing your setup.',steps:[
 'Use the same Wi-Fi as the laptop. Open its LAN dashboard address on both laptop and phone, exactly matching APP_ORIGIN.',
 'Keep Docker/PostgreSQL and npm run dev running. The laptop must stay awake for schedules and sensor rules; the browser can be closed.',
 'If the laptop IP changes, update APP_ORIGIN and restart the app; update the firmware MQTT_HOST if it used the old IP.',
 'Check browser Console for web errors and ESP32 Serial Monitor at 115200 baud for device errors. Share error text with secrets removed.',
 'Back up both the project configuration (including its encryption key) and the PostgreSQL database before upgrades.'
 ],example:'A device can be Online while the browser says Reconnecting live updates. Online describes device heartbeats; live updates describes the separate browser connection.',notes:[
 'Online: a recent heartbeat. Offline: no recent heartbeat. Disabled: access blocked by the owner.',
 'Queued/pending: a command is waiting for acknowledgement. Confirmed: firmware acknowledged it. Expired: no timely acknowledgement. Skipped: the routine did not issue that action; read its reason. Cancelled: pending work was cancelled. Unconfirmed: confirmation evidence is unavailable.',
 'Do not delete Docker volumes, rerun initial setup or regenerate TOKEN_ENCRYPTION_KEY to fix routine connection problems.',
 'This is trusted-LAN development access over HTTP/MQTT. Do not port-forward it publicly; internet deployment needs HTTPS and secured device transport.'
 ],trouble:[['Request origin is not allowed','Ensure the browser scheme, host and port exactly match APP_ORIGIN, without a trailing slash in the setting. Save .env and restart npm run dev.'],['Phone cannot load the page','Check the same Wi-Fi, Vite binding 0.0.0.0, Windows Private network firewall allowance for TCP 5173, and whether Wi-Fi client isolation is enabled.'],['Database connection refused','Start Docker and run docker compose up -d --wait postgres. Keep the working host port 5433 in your DATABASE_URL.'],['No command arrives at the ESP32','Verify live connection, command history, MQTT connection and correct device identity. Milestone 5 includes the UUID fix needed for local HTTP controls.']]}
];
export function manualForPath(path) {
 if(path.startsWith('/dashboard/devices/'))return manuals.find(x=>x.id==='control');
 return manuals.find(x=>x.path===path && !['start','support'].includes(x.id))??manuals[0];
}
