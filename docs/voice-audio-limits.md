# Shared voice input bounds

Microphone recordings use `MAX_RECORD_SECONDS = 240`; the recorder and capture-control labels derive their displayed maximum from that constant. Recordings shorter than two seconds or with an empty payload are rejected before upload.

Audio files retain their 300-second and 20 MB limits. The backend validates decoded duration independently of browser metadata. Transcription text is limited to 20,000 characters and must contain a letter; commercial sufficiency is evaluated by NLP rather than frontend keyword matching. CPU transcription polling allows 22 minutes, covering the backend's 1,260-second hard task deadline.
