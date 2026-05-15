#!/usr/bin/env python3
"""
Load offline dashboard artifacts into readacross SQL tables.

Sources (defaults point at the live magna-readacross/public bundle):
- magna-readacross/public/dashboard_data.json   (5 363 initiatives, etc.)
- magna-readacross/public/slides.json
- magna-readacross/public/index.html (VIDEO_LIBRARY fallback metadata)

Target tables:
- CosmaWaveInitiatives / PowertrainWaveInitiatives / ExteriorsWaveInitiatives / SeatingWaveInitiatives
- ArchetypeDefinitions / SiteArchetypes / PriorityInitiatives
- ThoughtStarters
- KnowledgeCenterAssets / VideoLibraryAssets
- DashboardMetaSnapshots (raw JSON for the meta / filter_options
  blocks that don't have a relational shape, so nothing in the offline
  bundle is dropped on the floor)
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable


def sql_string(value: Any) -> str:
    """Quote a value as a SQL Server NVARCHAR literal.

    The offline JSON occasionally hands us numeric IDs / nulls / non-strings;
    coerce to text so the seed never crashes on a stray int.
    """
    if value is None:
        return "NULL"
    text = value if isinstance(value, str) else str(value)
    return "N'" + text.replace("'", "''") + "'"


def sql_bool(value: bool | None) -> str:
    return "1" if bool(value) else "0"


def sql_decimal(value: Any) -> str:
    if value is None:
        return "NULL"
    try:
        return str(float(value))
    except Exception:
        return "NULL"


def sql_int(value: Any) -> str:
    if value is None:
        return "NULL"
    try:
        return str(int(value))
    except Exception:
        return "NULL"


def chunked(items: list[dict[str, Any]], size: int = 250) -> Iterable[list[dict[str, Any]]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def parse_video_library_from_index(index_path: Path) -> list[dict[str, Any]]:
    if not index_path.exists():
        return []
    text = index_path.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r"const\s+VIDEO_LIBRARY\s*=\s*\[(.*?)\];", text, flags=re.S)
    if not m:
        return []
    body = m.group(1)
    objects = re.findall(r"\{(.*?)\}", body, flags=re.S)
    out: list[dict[str, Any]] = []
    for raw in objects:
        def field(name: str) -> str | None:
            mm = re.search(rf"{re.escape(name)}\s*:\s*'([^']*)'", raw)
            return mm.group(1).strip() if mm else None

        title = field("title")
        src = field("src")
        if not title or not src:
            continue
        out.append(
            {
                "title": title,
                "description": field("description"),
                "video_url": "/" + src.lstrip("/"),
                "spend_category": field("spend_category"),
                "workstream": None,  # not explicit in original list
                "sort_order": len(out) + 1,
            }
        )
    return out


def build_insert_sql(table: str, cols: list[str], rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""
    statements: list[str] = []
    for batch in chunked(rows):
        values_sql: list[str] = []
        for row in batch:
            vals = [str(row.get(c, "NULL")) for c in cols]
            values_sql.append("(" + ", ".join(vals) + ")")
        statements.append(
            f"INSERT INTO readacross.{table} ({', '.join(cols)})\nVALUES\n" + ",\n".join(values_sql) + ";\n"
        )
    return "\n".join(statements)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dashboard-json",
        default="/Users/Sneha_Mani/Development/Magna/magna-readacross/public/dashboard_data.json",
    )
    parser.add_argument(
        "--slides-json",
        default="/Users/Sneha_Mani/Development/Magna/magna-readacross/public/slides.json",
    )
    parser.add_argument(
        "--video-index",
        default="/Users/Sneha_Mani/Development/Magna/magna-readacross/public/index.html",
    )
    parser.add_argument("--output-sql", default="/tmp/ingest_original_artifacts.sql")
    parser.add_argument("--apply-to-container", action="store_true")
    parser.add_argument("--sql-container", default="magna-readacross-sql")
    parser.add_argument("--sql-db", default="MagnaReadAcross")
    parser.add_argument("--sql-user", default="sa")
    parser.add_argument("--sql-password", default="Magna#Seed2026!")
    args = parser.parse_args()

    dashboard = json.loads(Path(args.dashboard_json).read_text(encoding="utf-8"))
    slides = json.loads(Path(args.slides_json).read_text(encoding="utf-8"))
    videos = parse_video_library_from_index(Path(args.video_index))

    site_archetypes_map: dict[str, list[str]] = dashboard.get("site_archetypes", {}) or {}
    archetypes_block: dict[str, Any] = dashboard.get("archetypes", {}) or {}
    archetype_defs: dict[str, Any] = archetypes_block.get("definitions", {}) or {}
    archetype_display: dict[str, str] = archetypes_block.get("display_names", {}) or {}

    initiatives: list[dict[str, Any]] = dashboard.get("initiatives", []) or []
    cosma_rows: list[dict[str, Any]] = []
    pt_rows: list[dict[str, Any]] = []
    ext_rows: list[dict[str, Any]] = []
    seat_rows: list[dict[str, Any]] = []

    # The offline bundle does not carry a per-initiative `subgroup` value;
    # subgroups are inferred from Site/Workstream by `05_backfill_subgroups.sql`.
    # We seed Subgroup as NULL here and rely on that backfill.
    for i in initiatives:
        ws = (i.get("workstream") or "").strip()
        base = {
            "InitiativeId": sql_string(i.get("id")),
            "Name": sql_string(i.get("name")),
            "Description": sql_string(i.get("description")),
            "Stage": sql_string(i.get("stage")),
            "Access": sql_string(i.get("access")),
            "InitiativeOwner": sql_string(i.get("owner")),
            "Subgroup": sql_string(i.get("subgroup") or i.get("site_group")),
            "SpendCategory": sql_string(i.get("spend_category")),
            "MfgProcess": sql_string(i.get("mfg_process")),
            "Lever": sql_string(i.get("lever")),
            "SubLever": sql_string(i.get("sub_lever")),
            "Nrb": sql_decimal(i.get("nrb")),
            "IsCategorized": sql_bool(i.get("is_categorized")),
        }
        site = i.get("site")
        if ws == "Cosma":
            arcs = site_archetypes_map.get(site or "", [])
            cosma_rows.append(
                {
                    **base,
                    "Site": sql_string(site),
                    "Archetypes": sql_string(",".join(arcs) if arcs else None),
                }
            )
        elif ws == "Powertrain":
            pt_rows.append({**base, "Site": sql_string(site)})
        elif ws == "Exteriors":
            ext_rows.append({**base, "Division": sql_string(site)})
        elif ws == "Seating":
            seat_rows.append({**base, "Site": sql_string(site)})

    archetype_rows = []
    for key, val in archetype_defs.items():
        desc = val.get("description") if isinstance(val, dict) else None
        archetype_rows.append(
            {
                "ArchetypeKey": sql_string(key),
                "DisplayName": sql_string(archetype_display.get(key, key)),
                "Workstream": sql_string("Cosma"),
                "Description": sql_string(desc),
                "IsActive": "1",
            }
        )

    site_archetype_rows = []
    for site, archetypes in site_archetypes_map.items():
        for a in archetypes:
            site_archetype_rows.append(
                {
                    "SiteName": sql_string(site),
                    "ArchetypeKey": sql_string(a),
                    "Workstream": sql_string("Cosma"),
                }
            )

    priority_rows = []
    priority_ids = dashboard.get("priority_ids") or {}
    if isinstance(priority_ids, dict):
        label = priority_ids.get("label", "Priority")
        for iid in (priority_ids.get("ids") or []):
            priority_rows.append(
                {
                    "InitiativeId": sql_string(str(iid)),
                    "PriorityLabel": sql_string(label),
                    "Workstream": "NULL",
                }
            )

    thought_rows = []
    for idx, ts in enumerate(dashboard.get("thought_starters", []) or [], start=1):
        thought_rows.append(
            {
                "SpendCategory": sql_string(ts.get("spend_category")),
                "MfgProcess": sql_string(ts.get("mfg_process")),
                "Lever": sql_string(ts.get("lever")),
                "SubLever": sql_string(ts.get("sub_lever")),
                "Text": sql_string(ts.get("text")),
                "AdvancedAutomation": sql_string(ts.get("advanced_automation")),
                "IsActive": "1",
                "SortOrder": sql_int(idx),
            }
        )

    knowledge_rows = []
    for s in slides:
        title = s.get("use_case_name") or f"Idea {s.get('idea_number')}"
        img = s.get("image")
        img_name = Path(img).name if img else None
        slide_url = f"/slides/{img_name}" if img_name else None
        knowledge_rows.append(
            {
                "Title": sql_string(title),
                "SpendCategory": sql_string(s.get("spend_category")),
                "Workstream": sql_string(None),
                "Description": sql_string(f"Source: {s.get('source') or 'n/a'} · Match: {s.get('match_status') or 'n/a'}"),
                "SlideUrl": sql_string(slide_url or "/slides/"),
                "ThumbnailUrl": sql_string(slide_url),
                "SortOrder": sql_int(s.get("slide_index") or 1000),
                "IsActive": "1",
            }
        )

    # ──────────────────────────────────────────────────────────────────────
    # Snapshot rows: capture every top-level block of dashboard_data.json so
    # nothing is lost even when it doesn't have a relational mapping. The
    # Sectioned snapshots are queryable via OPENJSON / JSON_VALUE in T-SQL.
    # ──────────────────────────────────────────────────────────────────────
    snapshot_rows: list[dict[str, Any]] = []
    generated_at = dashboard.get("generated") or ""
    source_file_literal = sql_string(str(Path(args.dashboard_json).name))
    snapshot_sections = [
        "generated", "cosma_meta", "powertrain_meta", "exteriors_meta",
        "seating_meta",
        "filter_options", "archetypes", "site_archetypes",
        "harmonization_notes", "priority_ids",
    ]
    disallowed_sections = sorted(
        key for key in dashboard.keys()
        if key.startswith("pnl_")
    )
    if disallowed_sections:
        print(
            "[warn] Ignoring disallowed dashboard sections: "
            + ", ".join(disallowed_sections),
            file=sys.stderr,
        )
    for section in snapshot_sections:
        if section not in dashboard:
            continue
        payload = dashboard[section]
        json_payload = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        snapshot_rows.append(
            {
                "SectionKey": sql_string(section),
                "GeneratedAtUtc": (
                    f"TRY_CONVERT(DATETIME2(0), {sql_string(generated_at)})"
                    if generated_at
                    else "SYSUTCDATETIME()"
                ),
                "SourceFile": source_file_literal,
                "PayloadJson": sql_string(json_payload),
            }
        )

    video_rows = []
    for v in videos:
        video_name = Path(v.get("video_url", "")).name
        normalized_video_url = f"/videos/{video_name}" if video_name else None
        video_rows.append(
            {
                "Title": sql_string(v.get("title")),
                "SpendCategory": sql_string(v.get("spend_category")),
                "Workstream": sql_string(v.get("workstream")),
                "Description": sql_string(v.get("description")),
                "VideoUrl": sql_string(normalized_video_url),
                "ThumbnailUrl": "NULL",
                "DurationSeconds": "NULL",
                "SortOrder": sql_int(v.get("sort_order")),
                "IsActive": "1",
            }
        )

    sql_parts: list[str] = [
        "SET NOCOUNT ON;\n",
        # DashboardMetaSnapshots may not exist in older deployments; create it
        # on the fly so the ingest script is self-contained.
        (
            "IF OBJECT_ID('readacross.DashboardMetaSnapshots', 'U') IS NULL\n"
            "BEGIN\n"
            "    CREATE TABLE readacross.DashboardMetaSnapshots\n"
            "    (\n"
            "        SnapshotId       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DashboardMetaSnapshots PRIMARY KEY,\n"
            "        SectionKey       NVARCHAR(64)    NOT NULL\n"
            "            CONSTRAINT CK_DashboardMetaSnapshots_SectionKey\n"
            "            CHECK (SectionKey IN (\n"
            "                N'generated', N'cosma_meta', N'powertrain_meta', N'exteriors_meta', N'seating_meta',\n"
            "                N'filter_options', N'archetypes', N'site_archetypes', N'harmonization_notes', N'priority_ids'\n"
            "            )),\n"
            "        GeneratedAtUtc   DATETIME2(0)    NOT NULL CONSTRAINT DF_DashboardMetaSnapshots_Gen DEFAULT (SYSUTCDATETIME()),\n"
            "        SourceFile       NVARCHAR(512)   NULL,\n"
            "        PayloadJson      NVARCHAR(MAX)   NOT NULL,\n"
            "        LoadedAtUtc      DATETIME2(0)    NOT NULL CONSTRAINT DF_DashboardMetaSnapshots_Loaded DEFAULT (SYSUTCDATETIME())\n"
            "    );\n"
            "    CREATE INDEX IX_DashboardMetaSnapshots_Section_Generated\n"
            "        ON readacross.DashboardMetaSnapshots (SectionKey, GeneratedAtUtc DESC);\n"
            "END;\n"
            "GO\n"
        ),
        "DELETE FROM readacross.DashboardMetaSnapshots;\n",
        "DELETE FROM readacross.VideoLibraryAssets;\n",
        "DELETE FROM readacross.KnowledgeCenterAssets;\n",
        "DELETE FROM readacross.ThoughtStarters;\n",
        "DELETE FROM readacross.PriorityInitiatives;\n",
        "DELETE FROM readacross.SiteArchetypes;\n",
        "DELETE FROM readacross.ArchetypeDefinitions;\n",
        "DELETE FROM readacross.SeatingWaveInitiatives;\n",
        "DELETE FROM readacross.ExteriorsWaveInitiatives;\n",
        "DELETE FROM readacross.PowertrainWaveInitiatives;\n",
        "DELETE FROM readacross.CosmaWaveInitiatives;\n\n",
        build_insert_sql(
            "CosmaWaveInitiatives",
            [
                "InitiativeId", "Name", "Description", "Stage", "Access", "InitiativeOwner",
                "Site", "Subgroup", "SpendCategory", "MfgProcess", "Lever", "SubLever",
                "Nrb", "IsCategorized", "Archetypes",
            ],
            cosma_rows,
        ),
        build_insert_sql(
            "PowertrainWaveInitiatives",
            [
                "InitiativeId", "Name", "Description", "Stage", "Access", "InitiativeOwner",
                "Site", "Subgroup", "SpendCategory", "MfgProcess", "Lever", "SubLever",
                "Nrb", "IsCategorized",
            ],
            pt_rows,
        ),
        build_insert_sql(
            "ExteriorsWaveInitiatives",
            [
                "InitiativeId", "Name", "Description", "Stage", "Access", "InitiativeOwner",
                "Division", "Subgroup", "SpendCategory", "MfgProcess", "Lever", "SubLever",
                "Nrb", "IsCategorized",
            ],
            ext_rows,
        ),
        build_insert_sql(
            "SeatingWaveInitiatives",
            [
                "InitiativeId", "Name", "Description", "Stage", "Access", "InitiativeOwner",
                "Site", "Subgroup", "SpendCategory", "MfgProcess", "Lever", "SubLever",
                "Nrb", "IsCategorized",
            ],
            seat_rows,
        ),
        build_insert_sql(
            "ArchetypeDefinitions",
            ["ArchetypeKey", "DisplayName", "Workstream", "Description", "IsActive"],
            archetype_rows,
        ),
        build_insert_sql(
            "SiteArchetypes",
            ["SiteName", "ArchetypeKey", "Workstream"],
            site_archetype_rows,
        ),
        build_insert_sql(
            "PriorityInitiatives",
            ["InitiativeId", "PriorityLabel", "Workstream"],
            priority_rows,
        ),
        build_insert_sql(
            "ThoughtStarters",
            ["SpendCategory", "MfgProcess", "Lever", "SubLever", "Text", "AdvancedAutomation", "IsActive", "SortOrder"],
            thought_rows,
        ),
        build_insert_sql(
            "KnowledgeCenterAssets",
            ["Title", "SpendCategory", "Workstream", "Description", "SlideUrl", "ThumbnailUrl", "SortOrder", "IsActive"],
            knowledge_rows,
        ),
        build_insert_sql(
            "VideoLibraryAssets",
            ["Title", "SpendCategory", "Workstream", "Description", "VideoUrl", "ThumbnailUrl", "DurationSeconds", "SortOrder", "IsActive"],
            video_rows,
        ),
        build_insert_sql(
            "DashboardMetaSnapshots",
            ["SectionKey", "GeneratedAtUtc", "SourceFile", "PayloadJson"],
            snapshot_rows,
        ),
        (
            "SELECT 'CosmaWaveInitiatives' AS table_name, COUNT(*) AS row_count FROM readacross.CosmaWaveInitiatives\n"
            "UNION ALL SELECT 'PowertrainWaveInitiatives', COUNT(*) FROM readacross.PowertrainWaveInitiatives\n"
            "UNION ALL SELECT 'ExteriorsWaveInitiatives', COUNT(*) FROM readacross.ExteriorsWaveInitiatives\n"
            "UNION ALL SELECT 'SeatingWaveInitiatives', COUNT(*) FROM readacross.SeatingWaveInitiatives\n"
            "UNION ALL SELECT 'ArchetypeDefinitions', COUNT(*) FROM readacross.ArchetypeDefinitions\n"
            "UNION ALL SELECT 'SiteArchetypes', COUNT(*) FROM readacross.SiteArchetypes\n"
            "UNION ALL SELECT 'PriorityInitiatives', COUNT(*) FROM readacross.PriorityInitiatives\n"
            "UNION ALL SELECT 'ThoughtStarters', COUNT(*) FROM readacross.ThoughtStarters\n"
            "UNION ALL SELECT 'KnowledgeCenterAssets', COUNT(*) FROM readacross.KnowledgeCenterAssets\n"
            "UNION ALL SELECT 'VideoLibraryAssets', COUNT(*) FROM readacross.VideoLibraryAssets\n"
            "UNION ALL SELECT 'DashboardMetaSnapshots', COUNT(*) FROM readacross.DashboardMetaSnapshots;\n"
            "GO\n"
        ),
    ]

    out_path = Path(args.output_sql)
    out_path.write_text("\n".join(x for x in sql_parts if x), encoding="utf-8")
    print(f"Wrote SQL ingest script: {out_path}")
    print(
        f"Prepared rows => cosma:{len(cosma_rows)} pt:{len(pt_rows)} ext:{len(ext_rows)} "
        f"seat:{len(seat_rows)} "
        f"archetypes:{len(archetype_rows)} site_archetypes:{len(site_archetype_rows)} "
        f"priority:{len(priority_rows)} thought:{len(thought_rows)} "
        f"knowledge:{len(knowledge_rows)} video:{len(video_rows)} snapshots:{len(snapshot_rows)}"
    )

    if args.apply_to_container:
        remote_sql = "/tmp/ingest_original_artifacts.sql"
        subprocess.run(["docker", "cp", str(out_path), f"{args.sql_container}:{remote_sql}"], check=True)
        subprocess.run(
            [
                "docker",
                "exec",
                args.sql_container,
                "/opt/mssql-tools18/bin/sqlcmd",
                "-b",
                "-S",
                "localhost",
                "-U",
                args.sql_user,
                "-P",
                args.sql_password,
                "-C",
                "-d",
                args.sql_db,
                "-i",
                remote_sql,
            ],
            check=True,
        )
        print("Applied ingest SQL successfully.")


if __name__ == "__main__":
    main()
