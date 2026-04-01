# Contract: Workflow Service Inputs

**Type**: GitHub Actions workflow_dispatch inputs
**Applies to**: speckit.yml, quick-impl.yml, verify.yml, health-scan.yml

---

## New Inputs

```yaml
inputs:
  needs_postgres:
    description: 'Start PostgreSQL service container'
    required: false
    default: 'true'
    type: boolean
  postgres_version:
    description: 'PostgreSQL version'
    required: false
    default: '14'
    type: string
  needs_redis:
    description: 'Start Redis service container'
    required: false
    default: 'false'
    type: boolean
  redis_version:
    description: 'Redis version'
    required: false
    default: '7'
    type: string
  needs_mysql:
    description: 'Start MySQL service container'
    required: false
    default: 'false'
    type: boolean
  mysql_version:
    description: 'MySQL version'
    required: false
    default: '8'
    type: string
  needs_mongo:
    description: 'Start MongoDB service container'
    required: false
    default: 'false'
    type: boolean
  mongo_version:
    description: 'MongoDB version'
    required: false
    default: '7'
    type: string
```

## Conditional Service Pattern

```yaml
services:
  postgres:
    image: ${{ inputs.needs_postgres == 'true' && format('postgres:{0}', inputs.postgres_version || '14') || '' }}
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_board_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  redis:
    image: ${{ inputs.needs_redis == 'true' && format('redis:{0}', inputs.redis_version || '7') || '' }}
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  mysql:
    image: ${{ inputs.needs_mysql == 'true' && format('mysql:{0}', inputs.mysql_version || '8') || '' }}
    env:
      MYSQL_ROOT_PASSWORD: mysql
      MYSQL_DATABASE: test_db
    ports:
      - 3306:3306
    options: >-
      --health-cmd "mysqladmin ping -h localhost"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  mongo:
    image: ${{ inputs.needs_mongo == 'true' && format('mongo:{0}', inputs.mongo_version || '7') || '' }}
    ports:
      - 27017:27017
    options: >-
      --health-cmd "mongosh --eval 'db.runCommand(\"ping\").ok'"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

## Default Behavior

- `needs_postgres` defaults to `true` (backward compatible — all current workflows use PostgreSQL)
- All other services default to `false` (no container started)
- Version defaults match current hardcoded values

## Dispatch-Side Contract

The ai-board application dispatches workflows via GitHub API. When dispatching, it must pass service inputs based on the target project's configuration. This is a **separate concern** (not in scope for AIB-475) — the workflow YAML changes are the only deliverable here.
