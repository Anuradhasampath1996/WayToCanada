#!/bin/sh
apk add --no-cache openssh-client >/dev/null 2>&1
chmod 600 /keys/.ec2-key.pem
i=1
while [ $i -le 8 ]; do
  echo "SSH attempt $i"
  if ssh -i /keys/.ec2-key.pem -o StrictHostKeyChecking=no -o ConnectTimeout=15 ubuntu@3.96.187.125 uptime; then
    exit 0
  fi
  sleep 20
  i=$((i+1))
done
echo FAILED
exit 1
