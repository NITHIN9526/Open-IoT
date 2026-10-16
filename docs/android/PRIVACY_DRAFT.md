# Open IoT Android privacy notice — draft, not for publication yet

The app operator must add their legal/operator name, contact address, effective date and public hosting URL, and verify the statements below before publishing.

Open IoT Android connects to an Open IoT server selected by the user. That server receives account information supplied during login or registration, device commands and other dashboard requests. Sensor readings, account records and command history are handled by that server. Its operator determines access, retention, hosting and deletion practices; users should consult that operator's policy.

The Android app stores the chosen server address and the embedded browser's session cookies and website storage on the phone. It does not implement its own password vault, advertising SDK, analytics SDK or native location/camera/microphone access. The connected server's web content can change independently and may have additional behavior. Network providers and server hosts may process connection metadata.

The release app requires HTTPS. The debug preview permits explicitly acknowledged private-network HTTP testing, which does not encrypt credentials or commands.

Users can select Server → Forget server and clear session to clear local app state. This does not delete the server account or revoke all server-side sessions. Users can manage/delete their account through My account on compatible Open IoT servers or contact their server operator. The app operator must provide a valid public deletion-information/request page and support contact where required for distribution.

Uninstalling removes the app's local storage. Server data remains under the server operator's control. Android app backup is disabled in this build.

Before publication, the operator must review the connected services, applicable privacy obligations, Google Play Data safety answers, account-deletion process, and policy wording. Do not publish this draft with missing operator details.
