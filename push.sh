#!/bin/bash
TOKEN="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"

rm -f .git/index.lock .git/config.lock 2>/dev/null

git add .

echo "Commit mesajı girin:"
read MSG

git commit -m "$MSG"

git push "https://siminkenan:$TOKEN@github.com/siminkenan/NoteBeatKids.git" main
echo "✅ GitHub'a gönderildi!"
