"""Speak one block with Kokoro-82M (ONNX export) and write a WAV file.

Stdin is the text. Arguments: model, voices, voice name, speed, dest wav.
"""
import sys

import soundfile as sf
from kokoro_onnx import Kokoro


def main() -> None:
    model, voices, voice, speed, dest = sys.argv[1:6]
    text = sys.stdin.read().strip()
    if not text:
        raise SystemExit('empty narration')
    engine = Kokoro(model, voices)
    audio, rate = engine.create(
        text,
        voice=voice,
        speed=float(speed),
        lang='en-us',
        sentence_pause=0.16,
        clause_pause=0.08,
    )
    sf.write(dest, audio, rate)


if __name__ == '__main__':
    main()
