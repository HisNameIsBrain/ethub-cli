# Secure Convex Sync + Training Bundle

Use `scripts/secure_convex_sync.sh` to:

1. Load required env vars from exported values in `~/.bashrc`
2. Generate a random verification token and SHA-256 hash
3. Run `ethub-cli` Convex sync using env-only credentials
4. Build a secure zip bundle for Qwen2.5 fine-tuning workflows

## Required env exports in ~/.bashrc

```bash
export ETHUB_API_KEY="..."
export CONVEX_DEPLOYMENT="..."
# optional
export CONVEX_URL="..."
export ETHUB_PROJECT_ID="..."
export ETHUB_ENV_API="..."
# optional command override
export ETHUB_CONVEX_SYNC_CMD="ethub-cli convex sync"
```

## Run

```bash
cd /root/ollama
./scripts/secure_convex_sync.sh
```

Optional:

```bash
./scripts/secure_convex_sync.sh --dry-run
./scripts/secure_convex_sync.sh --sync-only
./scripts/secure_convex_sync.sh --bundle-only
```
