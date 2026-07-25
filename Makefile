# =============================================================
#  Skoolio – Makefile
#  Convenience shortcuts for Docker Compose operations
# =============================================================

.PHONY: help build up dev down logs \
        shell-backend shell-frontend \
        restart restart-backend restart-frontend restart-nginx

# -------------------------------------------------------------
help:
	@echo ""
	@echo "  Production"
	@echo "    make build              Rebuild all images from scratch"
	@echo "    make up                 Start full stack (detached)"
	@echo "    make down               Stop and remove all containers"
	@echo "    make logs               Follow logs for all services"
	@echo ""
	@echo "  Development  (hot reload)"
	@echo "    make dev                Start with dev overrides"
	@echo ""
	@echo "  Debugging"
	@echo "    make shell-backend      Open sh inside backend container"
	@echo "    make shell-frontend     Open sh inside frontend container"
	@echo ""
	@echo "  Restart individual services"
	@echo "    make restart            Restart all"
	@echo "    make restart-backend"
	@echo "    make restart-frontend"
	@echo "    make restart-nginx"
	@echo ""

# -------------------------------------------------------------
build:
	docker compose build --no-cache

up:
	docker compose up -d

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

down:
	docker compose down

logs:
	docker compose logs -f

# -------------------------------------------------------------
shell-backend:
	docker compose exec backend sh

shell-frontend:
	docker compose exec frontend sh

# -------------------------------------------------------------
restart:
	docker compose restart

restart-backend:
	docker compose restart backend

restart-frontend:
	docker compose restart frontend

restart-nginx:
	docker compose restart nginx
