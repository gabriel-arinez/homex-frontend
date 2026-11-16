# Mobile audio conversion fixtures

Locally generated two-second, mono, 16 kHz 440 Hz tones (not private recordings or speech). These small AAC, Ogg Opus, MP4/AAC and FLAC files exercise browser codec decoding and full WAV conversion before ASR upload. They do not measure transcription accuracy.

Generation: `ffmpeg -f lavfi -i 'sine=frequency=440:sample_rate=16000:duration=2' -ac 1 tone.<extension>`.
