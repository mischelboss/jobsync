#!/bin/sh
set -e

# AUTH_SECRET signs sessions, ENCRYPTION_KEY encrypts stored API keys and the
# IMAP password. If either is not provided, generate a random one once and keep
# it in the data volume so it survives container restarts and image rebuilds.
ensure_secret() {
  name="$1"
  eval "current=\${$name:-}"
  [ -n "$current" ] && return 0

  file="/data/.$name"
  if [ ! -s "$file" ]; then
    (umask 077; node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" > "$file")
    echo "$name was not set — generated a random one and stored it in $file."
  fi
  export "$name=$(cat "$file")"
}

ensure_secret AUTH_SECRET
ensure_secret ENCRYPTION_KEY

# Run migrations as root (before switching users)
npx -y prisma@6.19.0 migrate deploy

# Fix /data permissions and run app as nextjs user
chown -R nextjs:nodejs /data
export HOME=/home/nextjs
exec su -s /bin/sh nextjs -c "HOSTNAME=0.0.0.0 PORT=${PORT:-3737} node server.js"
