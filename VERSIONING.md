# Skoolio Semantic Versioning & Conventional Commits Standard

## 1. Version Structure

All Skoolio sub-projects adhere to Semantic Versioning (`MAJOR.MINOR.PATCH`):

* **Backend API (`Backend/package.json`)**: `1.0.1`
* **School Admin Portal (`frontend/package.json`)**: `1.0.1`
* **Mobile Application (`skoolio_app/pubspec.yaml`)**: `1.0.1+2`

---

## 2. Conventional Commit Guidelines

Every commit message across all Skoolio repositories must follow the format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types & Semantic Version Bump Rules

| Type | Description | Version Bump | Example |
| :--- | :--- | :--- | :--- |
| `fix` | Bug fixes | **PATCH** (`1.0.0` ➔ `1.0.1`) | `fix: resolve academic_year_status PostgreSQL query error` |
| `perf` | Performance & DSA optimizations | **PATCH** (`1.0.0` ➔ `1.0.1`) | `perf: batch student bulk promotion SQL queries` |
| `refactor` | Code refactoring without behavior changes | **PATCH** (`1.0.0` ➔ `1.0.1`) | `refactor: clean up student repository queries` |
| `feat` | Backward-compatible new feature | **MINOR** (`1.0.1` ➔ `1.1.0`) | `feat: add student promotion route and web sidebar link` |
| `feat!` / `fix!` | Breaking API / Schema changes | **MAJOR** (`1.1.0` ➔ `2.0.0`) | `feat!: change authentication response payload format` |
| `docs` | Documentation updates | **None** | `docs: update API setup documentation` |
| `chore` | Dependency or config updates | **None** | `chore: update TypeScript types` |

---

## 3. Platform Version API Endpoint

The backend exposes a public endpoint for version verification across the platform:

```http
GET /api/platform/version
```

### Response Example:
```json
{
  "success": true,
  "message": "Platform version retrieved successfully",
  "data": {
    "app": "Skoolio Cloud ERP Backend API",
    "version": "1.0.1",
    "environment": "production",
    "server_time": "2026-09-21T23:33:00.000Z"
  }
}
```
