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

### When Developing a New Feature

1. **Before Development**
   - Read relevant functional specs to understand expected behavior
   - Review technical docs for implementation patterns

2. **After Development**
   - Update functional specs with new/changed behaviors
   - Update technical docs with implementation details
   - Ensure both reflect the current state (no historical notes)

### Documentation Principles

- ✅ **Current State Only**: Always document what exists NOW
- ✅ **No History**: Remove outdated information, don't mark as deprecated
- ✅ **Clear Separation**: Functional = WHAT, Technical = HOW
- ✅ **Living Documents**: Update with every feature/fix

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
