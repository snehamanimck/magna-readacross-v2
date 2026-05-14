.PHONY: up build down logs ingest ingest-and-restart \
        sql-shell seed-seating-wave backfill-subgroups seed-from-legacy \
        coverage

PROJECT_DIR := /Users/Sneha_Mani/Development/Magna/magna-readacross-v2
COMPOSE := docker compose -f "$(PROJECT_DIR)/docker-compose.yml" --project-directory "$(PROJECT_DIR)"

# Local SQL container settings — kept in sync with docker-compose.yml.
SQL_CONTAINER ?= magna-readacross-sql
SQL_USER      ?= sa
## NOTE: '#' is a comment character in Make so it must be backslash-escaped
## inside the recipe variable. The shell sees the literal value as expected.
SQL_PASSWORD  ?= Magna\#Seed2026!
SQL_DB        ?= MagnaReadAcross
SQL_TOOLS     ?= /opt/mssql-tools18/bin/sqlcmd
SQL_DIR       := $(PROJECT_DIR)/sql
API_BASE      ?= http://localhost:5080

# ──────────────────────────────────────────────────────────────────────────
# Compose / lifecycle
# ──────────────────────────────────────────────────────────────────────────
up:
	$(COMPOSE) up -d

build:
	$(COMPOSE) build api web

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

# ──────────────────────────────────────────────────────────────────────────
# Ingest (full pipeline: dashboard_data.json + slides + videos → SQL)
# ──────────────────────────────────────────────────────────────────────────
ingest:
	./scripts/ingest.sh

ingest-and-restart:
	./scripts/ingest.sh
	$(COMPOSE) up -d --build api web

# ──────────────────────────────────────────────────────────────────────────
# SQL helpers (run individual scripts inside the SQL container)
# ──────────────────────────────────────────────────────────────────────────
# Internal helper: copy a sql file into the container and apply it.
# Usage: $(call _apply_sql,relative_or_abs_path.sql)
define _apply_sql
	docker cp "$(1)" "$(SQL_CONTAINER):/tmp/$$(basename $(1))"
	docker exec "$(SQL_CONTAINER)" $(SQL_TOOLS) \
	    -S localhost -U "$(SQL_USER)" -P '$(SQL_PASSWORD)' -d "$(SQL_DB)" \
	    -C -N -b -i "/tmp/$$(basename $(1))"
endef

sql-shell:
	docker exec -it "$(SQL_CONTAINER)" $(SQL_TOOLS) \
	    -S localhost -U "$(SQL_USER)" -P '$(SQL_PASSWORD)' -d "$(SQL_DB)" -C -N

# Apply the standalone Seating Wave seed (parity with legacy dashboard_data.json
# initiatives where workstream=Seating). Idempotent — DELETEs first, then
# bulk-inserts all 343 rows. Runs the subgroup backfill afterwards so the
# Seat - NA / Seat - EU / Seat - CN labels are populated.
seed-seating-wave:
	$(call _apply_sql,$(SQL_DIR)/08_seed_seating_wave.sql)
	$(MAKE) backfill-subgroups

# Re-run the entity → subgroup backfill against all four Wave tables. Safe to
# run repeatedly; only touches rows whose Subgroup column is NULL/empty.
backfill-subgroups:
	$(call _apply_sql,$(SQL_DIR)/05_backfill_subgroups.sql)

# Convenience: one-shot path that re-seeds Seating from the v2 standalone
# script and then refreshes subgroup mappings. Useful when you need
# Seating data without running the full Python ingest.
seed-from-legacy: seed-seating-wave

# Hit the API health/coverage endpoint and pretty-print so you can confirm
# the four workstreams report 0 unmapped entities.
coverage:
	@curl -s "$(API_BASE)/api/Initiatives/subgroups/coverage" | python3 -m json.tool
