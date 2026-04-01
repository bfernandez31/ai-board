# Contract: Workflow Service Inputs

**Applies to**: speckit.yml, quick-impl.yml, verify.yml, health-scan.yml

## Inputs Schema

All workflows that run tests or need database access accept these `workflow_dispatch` inputs:

```yaml
inputs:
  # ... existing inputs ...

  # Conditional service inputs
  needs_postgres:
    description: 'Provision PostgreSQL service container'
    required: false
    default: 'false'
    type: boolean
  needs_redis:
    description: 'Provision Redis service container'
    required: false
    default: 'false'
    type: boolean
  needs_mysql:
    description: 'Provision MySQL service container'
    required: false
    default: 'false'
    type: boolean
  needs_mongo:
    description: 'Provision MongoDB service container'
    required: false
    default: 'false'
    type: boolean

  # Version inputs
  postgres_version:
    description: 'PostgreSQL version tag'
    required: false
    default: '14'
    type: string
  redis_version:
    description: 'Redis version tag'
    required: false
    default: '7'
    type: string
  mysql_version:
    description: 'MySQL version tag'
    required: false
    default: '8'
    type: string
  mongo_version:
    description: 'MongoDB version tag'
    required: false
    default: '7'
    type: string
```

## Service Container Definitions

```yaml
services:
  postgres:
    image: ${{ inputs.needs_postgres && format('postgres:{0}', inputs.postgres_version) || '' }}
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ai_board_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  redis:
    image: ${{ inputs.needs_redis && format('redis:{0}', inputs.redis_version) || '' }}
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  mysql:
    image: ${{ inputs.needs_mysql && format('mysql:{0}', inputs.mysql_version) || '' }}
    env:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: test
    ports:
      - 3306:3306
    options: >-
      --health-cmd "mysqladmin ping -h localhost"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

  mongo:
    image: ${{ inputs.needs_mongo && format('mongo:{0}', inputs.mongo_version) || '' }}
    ports:
      - 27017:27017
    options: >-
      --health-cmd "mongosh --eval 'db.runCommand({ping:1})'"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

## Caller Contract

The API dispatch endpoint (`/api/jobs` or equivalent) must pass service inputs based on the target project's infrastructure needs. For ai-board self-management, the defaults are:
- `needs_postgres: true`, `postgres_version: '14'`
- All others: `false`
