.PHONY: up build down logs ingest ingest-and-restart

PROJECT_DIR := /Users/Sneha_Mani/Development/Magna/magna-readacross-v2
COMPOSE := docker compose -f "$(PROJECT_DIR)/docker-compose.yml" --project-directory "$(PROJECT_DIR)"

up:
	$(COMPOSE) up -d

build:
	$(COMPOSE) build api web

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ingest:
	./scripts/ingest.sh

ingest-and-restart:
	./scripts/ingest.sh
	$(COMPOSE) up -d --build api web
