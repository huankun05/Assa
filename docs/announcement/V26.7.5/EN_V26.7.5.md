> **Release Date:** *`2026-09-02`*
> **GitHub Repository:** [`https://github.com/huankun05/Assa.git`](https://github.com/huankun05/Assa.git)

*V26.7.5 introduces NetEase Cloud Music login state management, like-status sync, and precise lyric matching, along with settings page music section improvements.*

## New Features

- Added NetEase Cloud Music login window, supporting login/logout from settings. Login state is persisted locally.
- Added like-status sync: after login, read NetEase "My Liked Songs" and keep local heart state consistent.
- Added local favorites counter in settings, showing liked songs count with manual refresh support.
- Added lyric exact-match mode: when NetEase is detected, prefer `title + artist` exact-match fetching to reduce mismatches and search overhead.
- Added "Like Sync" settings tab with login status prompt, hotkey configuration, and favorites count display.

## Improvements

- Improved settings music tab navigation by adding a dedicated "Like Sync" tab with icon.
- Improved login prompt copy for unauthenticated users to clarify actual benefits after login.
- Improved NetEase lyric fallback path: exact match first, then scored search, then retry with cleaned title/artist.

## Bug Fixes

- Fixed instrumental placeholder lyrics being treated as valid NetEase lyrics.
- Fixed NetEase login state file path and directory creation logic.

## Documentation

- Updated i18n strings for the new like sync settings page.

Thank you for your continued feedback and support. If you encounter new issues after upgrading, please continue to report them — we will follow up as soon as possible.
