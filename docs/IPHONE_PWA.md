# iPhone PWA quality guide

Portal is deliberately a standards-based PWA, not an App Store binary or a
Capacitor container. Installed from Safari, it gets a standalone window,
safe-area layout, local application icon, themed system chrome, offline shell,
and cached last-known projections while retaining the static deployment and
read-only Home Stack boundary.

## Native-feeling behavior in this repository

- Theme-correct HTML launch shell appears before React downloads or executes.
- A validated local catalog/status snapshot renders immediately, then refreshes
  in the background. Invalid snapshots are deleted and never displayed.
- Search and service details create browser history entries, so Back—including
  the iPhone edge-swipe gesture—dismisses the transient surface.
- Every service launch is a real HTTPS link. Because the manifest scope is the
  Portal origin, iOS keeps Portal navigation in the installed web app and sends
  service origins outside that scope to its browser surface. If an installed
  native app owns that HTTPS URL through Universal Links, iOS may launch it
  instead.
- The mobile tab bar keeps Home, Search, and System actions within thumb reach.
- The service sheet is scrollable with native momentum and supports a downward
  drag to dismiss from its handle.
- Current view, filter, and scroll position survive ordinary reloads and returns.
- Returning from the background triggers a fresh status request and refreshes a
  stale catalog.
- App updates wait for explicit confirmation instead of reloading underneath an
  active interaction.
- Safe-area insets, dynamic viewport units, 44px controls, visible focus,
  dialog focus containment, reduced motion, increased contrast, and solid
  no-blur fallbacks are all first-class behavior.

Liquid Glass is reserved for persistent navigation and transient controls.
Catalog cards and summaries are opaque surfaces so long lists scroll without a
backdrop-filter layer for every card.

## Performance diagnostics

The production JavaScript budget is enforced by `npm run check` at 180 KiB gzip.
To collect browser timing entries without shipping analytics, append
`?debug-performance` to the Portal URL. On page hide, the console prints paint,
largest-contentful-paint, layout-shift, long-task, and interaction entries that
the current browser supports. Diagnostics remain entirely on the device.

For each release, test both Safari and an installed Home Screen copy on at least
one recent iPhone and one older supported iPhone:

1. Cold launch, warm launch, and return after five minutes in the background.
2. Scroll the complete directory while watching for dropped frames or delayed
   taps; compare light and dark themes.
3. Open search and a detail sheet, dismiss each with Back/edge swipe, then drag
   the sheet down by its handle.
4. Rotate once, open the keyboard in each search field, and confirm no content
   or bottom navigation becomes permanently trapped off-screen.
5. Enable Reduce Motion, Increase Contrast, larger Dynamic Type, and VoiceOver;
   verify order, labels, focus, and 200% text zoom.
6. Launch offline after one successful online visit. The directory may use its
   last validated snapshot, but health must say stale or unavailable.
7. Deploy a second build while the first is open. Confirm the update notice
   appears and that choosing **Update now** activates the new build.

Automated Playwright projects cover 390px and 430px viewports, but Chromium
emulation cannot validate Safari compositing, edge-swipe feel, Home Screen
installation, status-bar integration, thermal behavior, or physical touch
latency. The physical-device pass is therefore a release requirement, not an
optional visual review.

## Intentional limits

A PWA cannot use iOS-owned navigation bars or tab bars. Capacitor can package a
separate native application and plugins can add native controls, but that adds
an Xcode/App Store lifecycle and is not the installed website described here.
Portal instead uses web-native history, CSS safe areas, and restrained
translucency while preserving one static artifact for every installation.

Web content cannot query which Home Screen web apps are installed, and iOS does
not expose an API for one PWA to force-launch another installed PWA. Portal
therefore does not guess, probe custom schemes, or maintain app-install state.
It supplies the authoritative HTTPS URL and lets iOS route it. Universal Links
can open an installed native application when that application and its domain
publish Apple’s required association, otherwise the destination opens as web
content. The system and the person’s prior choice ultimately decide.

Do not replace service anchors with `window.location.assign()` or blanket
`target="_blank"` behavior. Direct anchors preserve iOS scope routing and
Universal Link handling consistently across cards, details, Admin, and the
command palette. App-specific routing can be added later only when a service
has a documented, secure URL contract; presentation metadata must not become a
second service registry.

Notifications and badging are compatible future enhancements, but Portal does
not request permission without a concrete, user-controlled alert feature.

Primary platform references:

- [Apple: Configuring web applications](https://developer.apple.com/documentation/webkit/configuring-web-applications)
- [Apple: Supporting Universal Links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WebKit: Safari 26 release notes](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [W3C Web App Manifest](https://www.w3.org/TR/appmanifest/)
