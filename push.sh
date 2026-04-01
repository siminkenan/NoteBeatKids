#!/bin/bash
rm -f .git/index.lock .git/config.lock 2>/dev/null

git add .

echo "Commit mesajı girin:"
read MSG

git commit -m "$MSG"

git push "https://siminkenan:${GITHUB_TOKEN}@github.com/siminkenan/NoteBeatKids.git" main && echo "✅ GitHub'a gönderildi!" || echo "❌ Push başarısız!"
