# Runtime for the CE capture harness: Wine (32-bit prefix), Xvfb, xdotool,
# ImageMagick and Tesseract. The image contains no game data; the private
# install is bind-mounted at /game on the sfc2-ci VM only.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends \
      wine wine32:i386 wine64 xvfb xdotool x11-utils x11-xserver-utils imagemagick xauth \
      tesseract-ocr python3 python3-numpy python3-pil procps ca-certificates fonts-dejavu-core cabextract \
      libgl1-mesa-dri:i386 libgl1:i386 mesa-utils \
    && rm -rf /var/lib/apt/lists/*
RUN userdel -r ubuntu 2>/dev/null; useradd -m -u 1000 wineuser
USER wineuser
ENV WINEARCH=win32 WINEPREFIX=/home/wineuser/.wine WINEDEBUG=-all
WORKDIR /home/wineuser
