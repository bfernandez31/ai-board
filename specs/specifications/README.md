# AI Board Documentation

## 📚 Documentation Structure

The AI Board documentation is organized into two distinct but complementary sections:

### 🎯 [Functional Specifications](./functional/)
**For: Product Owners, Stakeholders, QA Teams, Business Analysts**

Describes WHAT the application does from a user perspective:
- User-facing behaviors and workflows
- Business rules and constraints
- Feature capabilities and limitations
- Current state of the application (no historical changes)

[➡️ Read Functional Documentation](./functional/README.md)

### 🔧 [Technical Documentation](./technical/)
**For: Developers, DevOps Engineers, Technical Architects**

Describes HOW the application is implemented:
- Architecture and design patterns
- API specifications and data models
- Implementation details and configurations
- Deployment and testing infrastructure

[➡️ Read Technical Documentation](./technical/README.md)

## 📝 Documentation Maintenance

### Automated Documentation Updates

Documentation is **automatically updated** during the feature development workflow:

#### Development Stages (SPECIFY → PLAN → BUILD)
- **Ticket specification** in `specs/{branch}/spec.md` is created and maintained
- **Global documentation** (`specs/specifications/`) remains unchanged during development
- AI-BOARD assistant can help iterate on ticket specifications

#### Verification Stage (VERIFY)
- **Automated workflow** updates global documentation before PR creation
- Updates functional specs with new user-facing behaviors
- Updates technical docs with implementation details
- Documentation reflects the verified, tested implementation

#### What Gets Updated Automatically
- ✅ **Functional Specs**: New features, changed behaviors, updated workflows
- ✅ **Technical Docs**: New API endpoints, data models, implementation patterns
- ✅ **CLAUDE.md**: New technologies, architectural patterns, conventions

### Documentation Principles

- ✅ **Current State Only**: Always document what exists NOW
- ✅ **No History**: Remove outdated information, don't mark as deprecated
- ✅ **Clear Separation**: Functional = WHAT, Technical = HOW
- ✅ **Living Documents**: Updated automatically with every feature
- ✅ **Single Update**: Documentation updated once before PR (not during iterations)

## 🌐 Multi-Repository Support

AI-Board supports managing tickets for **external GitHub repositories**:

### Key Capabilities
- **Centralized Workflows**: All GitHub Actions workflows remain in ai-board repository
- **External Repository Execution**: Workflows checkout and execute against external project repositories
- **Unified Management**: Single interface to manage multiple projects across different repositories
- **Automated Workflows**: Same automation (spec generation, testing, deployment) for all projects

### Quick Setup
1. Configure GitHub repository (owner + repo name) during project creation
2. Ensure external project has required structure (ai-board plugin as submodule, `.specify/scripts/`)
3. Configure `GH_PAT` secret in ai-board repository with `repo` scope
4. Start creating tickets - workflows automatically execute against external repository

**Learn More**:
- [Functional: External Repository Support](./functional/05-projects.md#external-repository-support)
- [Technical: Multi-Repository Architecture](./technical/implementation/integrations.md#multi-repository-workflow-architecture)

## 🗂️ Quick Navigation

### By Feature Area

| Feature | Functional Spec | Technical Details |
|---------|----------------|-------------------|
| Kanban Board | [Board Behavior](./functional/01-kanban-board.md) | [Architecture](./technical/architecture/overview.md) |
| Tickets | [Ticket Management](./functional/02-ticket-management.md) | [Data Model](./technical/architecture/data-model.md#ticket-model) |
| Comments | [Collaboration](./functional/03-collaboration.md) | [API Endpoints](./technical/api/endpoints.md#comments) |
| Automation | [Workflows](./functional/04-automation.md) | [GitHub Actions](./technical/quality/deployment.md) |
| Projects | [Multi-Project](./functional/05-projects.md) | [Authentication](./technical/implementation/authentication.md) |
| UI/UX | [Interface](./functional/06-user-interface.md) | [State Management](./technical/implementation/state-management.md) |

### By Task

| I want to... | Start here |
|--------------|------------|
| Understand a feature | [Functional Specs](./functional/) |
| Implement a feature | [Technical Docs](./technical/) |
| Add an API endpoint | [API Reference](./technical/api/endpoints.md) |
| Modify the database | [Data Model](./technical/architecture/data-model.md) |
| Write tests | [Testing Guide](./technical/quality/testing.md) |
| Deploy changes | [Deployment](./technical/quality/deployment.md) |
| Debug an issue | [Architecture Overview](./technical/architecture/overview.md) |

## 📦 Archive

The original consolidated specifications (before reorganization) are preserved in:
- [archive/](./archive/) - Complete backup of original documentation

## 🚀 Getting Started

### For New Team Members
1. Start with [Functional Overview](./functional/README.md)
2. Read [Architecture Overview](./technical/architecture/overview.md)
3. Explore specific features as needed

### For Product Managers
- Focus on [Functional Specifications](./functional/)
- Refer to business rules and constraints
- Review UI behaviors and workflows

### For Developers
- Start with [Technical README](./technical/README.md)
- Review [Stack](./technical/architecture/stack.md) and [Data Model](./technical/architecture/data-model.md)
- Check [API Reference](./technical/api/endpoints.md) for implementation

---

*This documentation represents the current state of the AI Board application. It is continuously updated with each feature development.*
