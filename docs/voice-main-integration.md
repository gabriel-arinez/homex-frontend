# Coordinated voice integration CI

Normal PR/push/main contract and real-stack jobs now use backend revision `7c9e748213a23e650d76120e64d9a8b2fdd6a3df`, including NLP 0.1.29 and sufficient synthetic commercial dictations. `contracts/backend-ref.txt` records the same immutable peer. Strict OpenAPI byte comparison and generated-client drift checks remain enabled. Manual `integration_peer_ref` overrides remain available for final merged-main verification.

Gitleaks initially reported two unsigned browser mock JWTs from historical commits. Their decoded header uses `alg:none` and the signature is a literal test marker, not a real credential. Only those two exact commit/file/rule/line fingerprints were added to the existing `.gitleaksignore` convention. No rule/path is disabled, no actual secret is exempted, and the security workflow still scans history. See the [official fingerprint documentation](https://github.com/gitleaks/gitleaks#-gitleaksignore).

These fixes preserve the entire feature history, the assistant's 15-second/20-word validation and all CI gates. Earlier integration runs using old peer schemas failed and their obsolete long-running jobs were cancelled before replacement runs; cancellation is not counted as success.
