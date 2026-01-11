# Quick Deploy Guide - Fast & Simple

## Option 1: GitHub Deploy (Recommended) ⭐⭐⭐

This is the MOST reliable method!

### Steps:

1. **Create GitHub Repository**
```bash
# In D:\Code\tvbox directory
cd D:\Code\tvbox

# Initialize Git
git init
git add .
git commit -m "Initial commit: TVBox aggregator"

# Create repository on GitHub: https://github.com/new
# Repository name: tvbox
# Then push (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/tvbox.git
git branch -M main
git push -u origin main
```

2. **Deploy on Deno Deploy**
   - Visit: https://deno.com/deploy
   - Click: **"New Project"**
   - Select: **"Deploy from GitHub"**
   - Choose your `tvbox` repository
   - Entry Point: `src/main.ts`
   - Click: **"Link and Deploy"**

3. **Done!** 🎉
   - Service: `https://tvbox-aggregator.deno.dev`
   - Admin: `https://tvbox-aggregator.deno.dev/admin`

---

## Option 2: Command Line Deploy

```bash
# 1. Login to Deno
deno login

# 2. Install deployctl
deno install -A -f https://deno.land/x/deployctl/deployctl.ts

# 3. Deploy
cd D:\Code\tvbox
deployctl deploy --project=tvbox-aggregator --entrypoint=src/main.ts --prod
```

---

## After Deployment

### Test Your Service:

```bash
# Check service status
curl https://tvbox-aggregator.deno.dev/

# Get configuration
curl https://tvbox-aggregator.deno.dev/api/config

# Health check
curl https://tvbox-aggregator.deno.dev/api/health

# View admin panel
# Open browser: https://tvbox-aggregator.deno.dev/admin
```

### Admin Panel Features:

✅ Real-time Statistics
✅ Source Management
✅ Quick Actions (refresh, health check, clear cache)

---

## Troubleshooting

### Deploy Failed?

**Error**: `Project name already exists`

**Solution**: Use different project name
```bash
deployctl deploy --project=tvbox-aggregator-2 --entrypoint=src/main.ts --prod
```

### Browser Auth Failed?

**Solution**:
1. Clear browser cache
2. Try incognito mode
3. Check network connection

---

## Deploy Checklist

- [ ] Deno installed
- [ ] Chosen deployment method
- [ ] Logged in to Deno
- [ ] Code pushed to GitHub (Option 1)
- [ ] Deployment successful
- [ ] Tested admin panel
- [ ] Tested API endpoints

---

## Success!

**Your TVBox Aggregator is live!**

- 🌐 Service: `https://tvbox-aggregator.deno.dev`
- 🎨 Admin: `https://tvbox-aggregator.deno.dev/admin`
- 📊 Stats: `https://tvbox-aggregator.deno.dev/api/stats`
- ❤️ Health: `https://tvbox-aggregator.deno.dev/api/health`

Enjoy! 🎉
