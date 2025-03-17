#!/bin/bash

# Script to push changes to GitHub main branch

echo "📦 Pushing changes to GitHub main branch..."

# Check if we need to update the remote URL to SSH
if git remote -v | grep -q "https://github.com"; then
  echo "🔄 Updating remote URL to use SSH..."
  REPO_NAME=$(git remote get-url origin | sed 's|https://github.com/||' | sed 's|\.git$||')
  git remote set-url origin "git@github.com:${REPO_NAME}.git"
  echo "✅ Remote URL updated to SSH"
fi

# Add all changes
git add .

# Check if there are changes to commit
if ! git diff --staged --quiet; then
  # Commit changes with timestamp
  git commit -m "Update $(date +'%Y-%m-%d %H:%M:%S')"
  
  # Push to main branch
  git push origin main
  
  echo "✅ Changes pushed successfully!"
else
  echo "ℹ️ No changes to commit."
fi

# Make sure script is executable
chmod +x $0