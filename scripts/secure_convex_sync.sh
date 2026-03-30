#!/usr/bin/env bash
set -euo pipefail

umask 077

BASHRC_PATH="${BASHRC_PATH:-$HOME/.bashrc}"
TRAINING_DIR="${TRAINING_DIR:-/root/ollama/training_data}"
SYNC_CMD_RAW="${ETHUB_CONVEX_SYNC_CMD:-ethub-cli convex sync}"
DRY_RUN="${DRY_RUN:-0}"
ONLY_BUNDLE="${ONLY_BUNDLE:-0}"
ONLY_SYNC="${ONLY_SYNC:-0}"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --bundle-only) ONLY_BUNDLE=1 ;;
    --sync-only) ONLY_SYNC=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--dry-run] [--bundle-only] [--sync-only]" >&2
      exit 1
      ;;
  esac
done

if [[ "$ONLY_BUNDLE" == "1" && "$ONLY_SYNC" == "1" ]]; then
  echo "Cannot combine --bundle-only and --sync-only" >&2
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_cmd date
require_cmd sha256sum

zip_with_fallback() {
  local output_zip="$1"
  local input_dir="$2"

  if command -v zip >/dev/null 2>&1; then
    zip -qr "$output_zip" "$input_dir"
    return 0
  fi

  if command -v bsdtar >/dev/null 2>&1; then
    bsdtar -a -cf "$output_zip" "$input_dir"
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -m zipfile -c "$output_zip" "$input_dir"
    return 0
  fi

  echo "Missing required command: zip (or bsdtar/python3 fallback)" >&2
  exit 1
}

load_export_from_bashrc() {
  local key="$1"
  local line value

  if [[ -n "${!key:-}" ]]; then
    return 0
  fi

  if [[ ! -r "$BASHRC_PATH" ]]; then
    return 1
  fi

  line="$(grep -E "^[[:space:]]*export[[:space:]]+${key}=" "$BASHRC_PATH" | tail -n 1 || true)"
  [[ -z "$line" ]] && return 1

  value="${line#*=}"
  value="${value%$'\r'}"

  if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf -v "$key" '%s' "$value"
  export "$key"
}

load_export_from_bashrc ETHUB_API_KEY || true
load_export_from_bashrc CONVEX_DEPLOYMENT || true
load_export_from_bashrc CONVEX_URL || true
load_export_from_bashrc ETHUB_PROJECT_ID || true
load_export_from_bashrc ETHUB_ENV_API || true

: "${ETHUB_API_KEY:?ETHUB_API_KEY must be set in environment or exported in ~/.bashrc}"
: "${CONVEX_DEPLOYMENT:?CONVEX_DEPLOYMENT must be set in environment or exported in ~/.bashrc}"

if [[ "$ONLY_BUNDLE" != "1" ]]; then
  require_cmd ethub-cli
fi

nonce="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d '[:space:]')"
ts_utc="$(date -u +%Y%m%dT%H%M%SZ)"
verify_token="${nonce}.${ts_utc}"
verify_token_sha256="$(printf '%s' "$verify_token" | sha256sum | awk '{print $1}')"

export ETHUB_VERIFY_TOKEN="$verify_token"
export ETHUB_VERIFY_TOKEN_SHA256="$verify_token_sha256"

mkdir -p "$TRAINING_DIR"

if [[ "$ONLY_BUNDLE" != "1" ]]; then
  read -r -a sync_cmd <<<"$SYNC_CMD_RAW"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[DRY RUN] Would run: ${sync_cmd[*]}"
  else
    "${sync_cmd[@]}"
  fi
fi

if [[ "$ONLY_SYNC" != "1" ]]; then
  bundle_base="secure_convex_sync_${ts_utc}_${verify_token_sha256:0:12}"
  bundle_dir="$TRAINING_DIR/$bundle_base"
  zip_path="$TRAINING_DIR/${bundle_base}.zip"
  checksum_path="$TRAINING_DIR/${bundle_base}.zip.sha256"

  mkdir -p "$bundle_dir/convex"
  cp /root/ollama/convex/*.ts /root/ollama/convex/*.js "$bundle_dir/convex/" 2>/dev/null || true

  cat > "$bundle_dir/sync_metadata.json" <<META
{
  "created_at_utc": "$ts_utc",
  "convex_deployment": "$CONVEX_DEPLOYMENT",
  "convex_url": "${CONVEX_URL:-}",
  "ethub_project_id": "${ETHUB_PROJECT_ID:-}",
  "ethub_env_api": "${ETHUB_ENV_API:-}",
  "verification_token_sha256": "$verify_token_sha256",
  "notes": "No secrets are stored. Raw token and API keys are intentionally excluded."
}
META

  cat > "$bundle_dir/fine_tuning_manifest.jsonl" <<JSONL
{"source":"convex/schema.ts","task":"code-understanding","model_target":"qwen2.5","tag":"database-schema"}
{"source":"convex/logs.ts","task":"mutation-pattern","model_target":"qwen2.5","tag":"convex-mutation"}
{"source":"convex/server.js","task":"mutation-pattern","model_target":"qwen2.5","tag":"convex-mutation"}
JSONL

  (
    cd "$TRAINING_DIR"
    zip_with_fallback "${bundle_base}.zip" "$bundle_base"
    sha256sum "${bundle_base}.zip" > "${bundle_base}.zip.sha256"
  )

  rm -rf "$bundle_dir"

  chmod 600 "$zip_path" "$checksum_path"

  echo "Secure training bundle created: $zip_path"
  echo "Checksum file created: $checksum_path"
fi

echo "Verification token SHA-256: $verify_token_sha256"
