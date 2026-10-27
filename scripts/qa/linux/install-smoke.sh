#!/bin/sh
# Installs a Chronexus .deb (or runs an AppImage) in a clean distribution container, starts
# the installed app under Xvfb with an empty profile and takes a screenshot (docs/QA.md).
#   docker run --rm -v <packages>:/pkg:ro -v <out>:/out <distro> sh install-smoke.sh deb|appimage
# Optional: /qa/root.crt is added to the system trust store (a local test server's CA).
set -eu
mode="$1"
export DEBIAN_FRONTEND=noninteractive
apt-get update >/dev/null
apt-get install -y --no-install-recommends xvfb xauth dbus-x11 imagemagick xdotool \
  ca-certificates fonts-dejavu-core >/dev/null
if [ -f /qa/root.crt ]; then
  cp /qa/root.crt /usr/local/share/ca-certificates/chronexus-qa.crt && update-ca-certificates >/dev/null
fi
case "$mode" in
  deb)
    apt-get install -y --no-install-recommends /pkg/*.deb >/dev/null
    app=/usr/bin/chronexus
    dpkg -s chronexus | grep -E '^(Package|Version|Architecture|Depends):' | cut -c1-200
    ;;
  appimage)
    # Like other Tauri AppImages it uses the host's graphics and sound stack (libgbm,
    # ALSA), present on desktop systems but not in a minimal container.
    apt-get install -y --no-install-recommends libgtk-3-0 libgbm1 libegl1 libasound2 >/dev/null
    cp /pkg/*.AppImage /tmp/chronexus.AppImage && chmod +x /tmp/chronexus.AppImage
    app="/tmp/chronexus.AppImage --appimage-extract-and-run"
    ;;
esac
export DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1
Xvfb :99 -screen 0 1280x800x24 >/tmp/xvfb.log 2>&1 &
sleep 2
useradd -m player 2>/dev/null || true
su player -c "DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 WEBKIT_DISABLE_COMPOSITING_MODE=1 dbus-run-session -- $app >/tmp/app.log 2>&1 &"
sleep 20
pgrep -a chronexus | head -3 || { echo "app not running"; tail -30 /tmp/app.log; exit 1; }
ls -la /home/player/.local/share/it.nodex.desktop
import -window root "/out/$(. /etc/os-release; echo "$ID-$VERSION_ID")-$mode.png"
echo "screenshot written"
