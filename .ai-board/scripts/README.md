# AI Board Scripts

Utility scripts for managing the AI Board application.

## Database Scripts

### Create Development Project

Creates or updates the development project (ID 3) with proper GitHub repository configuration.

```bash
npx tsx scripts/create-dev-project.ts
```

**What it does:**
- Creates project ID 3 with name "AI Board Development"
- Configures GitHub owner: `bfernandez31`
- Configures GitHub repo: `ai-board`
- Safe to run multiple times (uses upsert)

**After running:**
- Access your development board at: `http://localhost:3000/projects/3/board`
- All GitHub Actions workflows will dispatch to the correct repository
- Your data is isolated from E2E test data (projects 1-2)

## Project Organization

### Test Projects (Auto-managed)
- **Project 1**: E2E test project (cleaned before each test run)
- **Project 2**: Secondary test project for cross-project tests

### Development Projects
- **Project 3**: Main development project (created by script above)
- **Project 4+**: Available for additional development environments

## Important Notes

⚠️ **Never use projects 1-2 for development** - they are automatically cleaned by tests
✅ **Always use project 3 or higher** for manual testing and development
