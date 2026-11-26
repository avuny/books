#!/usr/bin/env bash
set -euo pipefail
BUMP=${1:?usage: release.sh patch|minor|major}

# bump version in root package.json
node -e "
const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));
const [a,b,c]=p.version.split('.').map(Number);
const v={patch:[a,b,c+1],minor:[a,b+1,0],major:[a+1,0,0]}['$BUMP'].join('.');
p.version=v;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
console.log(v)" > /tmp/new_version
V=$(cat /tmp/new_version)
DATE=$(date +%F)

# move Unreleased notes under the new version
sed -i "s/## \[Unreleased\]/## [Unreleased]\n\n## [$V] - $DATE/" CHANGELOG.md

git add package.json CHANGELOG.md
git commit -m "chore(release): v$V"
git tag -a "v$V" -m "v$V"
echo "Tagged v$V - push with: git push origin dev --tags"
