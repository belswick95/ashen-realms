# Phones, iPad and keyboards

Use the four-corner fullscreen button beside the minimap. It requests fullscreen for the entire page, including HUD and dialogs. Press it again to exit. Support is detected at runtime; denied requests show a usable fallback instead of failing silently.

For the most reliable iPhone experience, open Safari's Share menu, choose **Add to Home Screen**, enable **Open as Web App** if offered, and launch Eldervale from that icon. The manifest requests standalone display; no service worker or offline game cache is installed. Signing in again may be necessary. The world still requires an internet connection.

Chat starts as a compact Chat button on phones and tablets; tap it to open. Desktop chat starts open. This choice is made at game startup, not reset on every rotation or resize.

Magic Keyboard and other hardware keyboards use the same controls as desktop, even when touch input is available: W/S or up/down move, A/D or left/right turn, Q/E strafe, Space jumps, Shift runs. Keyboard events use physical codes when available and key-name fallbacks otherwise. Browser shortcut combinations and text entry are left alone. Tap/click the world after typing to return focus to movement. Release, loss of focus and orientation changes clear held movement.

Browser checks emulate a touch device receiving physical keyboard events; they are not a test on physical Magic Keyboard hardware.

Research consulted:
- [Apple: turn a website into an app on iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)
- [Apple: turn a website into an app on iPad](https://support.apple.com/en-mide/guide/ipad/ipad8f1f7a29/ipados)
- [MDN: requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) — user activation, capability limits, navigation UI and fullscreen lifecycle.
- [WebKit Safari 26.4](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/) — hardware keyboard attachment and fullscreen behavior continue to evolve, so do not infer support from device name or OS version.
