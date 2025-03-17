#!/bin/bash

# Script to push changes to GitHub main branch

echo "📦 Pushing changes to GitHub main branch..."

# Add all changes
git add .

# Commit changes with timestamp
git commit -m "Update $(date +'%Y-%m-%d %H:%M:%S')"

# Push to main branch
git push origin main

echo "✅ Changes pushed successfully!"