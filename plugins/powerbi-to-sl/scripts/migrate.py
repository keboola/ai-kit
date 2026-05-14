#!/usr/bin/env python3
"""Power BI semantic model → Keboola semantic layer migrator.

Two input shapes supported:
  - tmdl: folder of *.tmdl files extracted with the Power BI Modeling MCP
    `--readonly` flag. Canonical input — captures DAX + Power Query M
    expressions verbatim.
  - per-table-json: one *_semantic_layer.json file per Power BI table,
    produced by older `get_semantic_model` calls. Missing M steps.

Output: JSON files under <out>/ matching the Keboola metastore
semantic-* schemas. `modelUUID` is generated locally and propagated; the
push step may replace it server-side if needed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

# ---- Type mapping ---------------------------------------------------------

PBI_TO_SL_TYPE = {
    "string": "string",
    "text": "string",
    "int64": "integer",
    "integer": "integer",
    "double": "decimal",
    "decimal": "decimal",
    "currency": "decimal",
    "datetime": "datetime",
    "date": "date",
    "time": "datetime",
    "boolean": "boolean",
    "binary": "string",
}

PBI_CARDINALITY_TO_JOIN = {
    "manyToOne": "inner",
    "oneToOne": "inner",
    "oneToMany": "left",
}


def map_type(pbi_type: str | None) -> str:
    if not pbi_type:
        return "string"
    return PBI_TO_SL_TYPE.get(pbi_type.lower().strip(), "string")


# ---- Slug helpers ---------------------------------------------------------

_slug_re = re.compile(r"[^a-z0-9]+")


def slugify(s: str) -> str:
    return _slug_re.sub("-", s.lower()).strip("-") or "unnamed"


# ---- Intermediate representation ------------------------------------------


@dataclass
class PbiColumn:
    name: str
    data_type: str | None = None
    description: str | None = None
    is_key: bool = False
    is_hidden: bool = False


@dataclass
class PbiMeasure:
    name: str
    expression: str
    description: str | None = None


@dataclass
class PbiTable:
    name: str
    description: str | None = None
    columns: list[PbiColumn] = field(default_factory=list)
    measures: list[PbiMeasure] = field(default_factory=list)


@dataclass
class PbiRelationship:
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    cardinality: str = "manyToOne"
    is_active: bool = True


@dataclass
class PbiModel:
    tables: list[PbiTable] = field(default_factory=list)
    relationships: list[PbiRelationship] = field(default_factory=list)


# ---- Loaders --------------------------------------------------------------


def load_per_table_json(input_dir: Path) -> PbiModel:
    """Parse per-table JSON files (Power BI Modeling MCP `get_semantic_model`).

    Each file represents one Power BI table. Tolerant of shape variations.
    """
    model = PbiModel()
    files = sorted(input_dir.glob("*_semantic_layer.json")) + sorted(
        input_dir.glob("*.json")
    )
    seen: set[str] = set()
    for f in files:
        if f.name in seen:
            continue
        seen.add(f.name)
        with f.open() as fp:
            doc = json.load(fp)
        for tbl in _iter_tables(doc):
            t = PbiTable(
                name=tbl.get("name") or f.stem,
                description=tbl.get("description"),
            )
            for col in tbl.get("columns", []) or []:
                t.columns.append(
                    PbiColumn(
                        name=col["name"],
                        data_type=col.get("dataType") or col.get("type"),
                        description=col.get("description"),
                        is_key=bool(col.get("isKey")),
                        is_hidden=bool(col.get("isHidden")),
                    )
                )
            for m in tbl.get("measures", []) or []:
                t.measures.append(
                    PbiMeasure(
                        name=m["name"],
                        expression=m.get("expression", ""),
                        description=m.get("description"),
                    )
                )
            model.tables.append(t)
        for rel in _iter_relationships(doc):
            model.relationships.append(
                PbiRelationship(
                    from_table=rel["fromTable"],
                    from_column=rel["fromColumn"],
                    to_table=rel["toTable"],
                    to_column=rel["toColumn"],
                    cardinality=rel.get("cardinality", "manyToOne"),
                    is_active=rel.get("isActive", True),
                )
            )
    return model


def _iter_tables(doc: Any) -> Iterable[dict]:
    # Common shapes: top-level "tables", or doc itself is one table, or
    # "model": {"tables": [...]}, or "semanticModel": {...}.
    if isinstance(doc, dict):
        if "tables" in doc and isinstance(doc["tables"], list):
            yield from doc["tables"]
        elif "model" in doc and isinstance(doc["model"], dict):
            yield from _iter_tables(doc["model"])
        elif "semanticModel" in doc and isinstance(doc["semanticModel"], dict):
            yield from _iter_tables(doc["semanticModel"])
        elif "columns" in doc or "measures" in doc:
            yield doc
    elif isinstance(doc, list):
        for item in doc:
            yield from _iter_tables(item)


def _iter_relationships(doc: Any) -> Iterable[dict]:
    if isinstance(doc, dict):
        if "relationships" in doc and isinstance(doc["relationships"], list):
            yield from doc["relationships"]
        elif "model" in doc and isinstance(doc["model"], dict):
            yield from _iter_relationships(doc["model"])
        elif "semanticModel" in doc and isinstance(doc["semanticModel"], dict):
            yield from _iter_relationships(doc["semanticModel"])


def load_tmdl(input_dir: Path) -> PbiModel:
    """Parse a TMDL folder (Power BI Modeling MCP `--readonly` output).

    TMDL is a custom indentation-based DSL. This is a minimal regex parser
    covering: table headers, column blocks with `dataType`, measure blocks
    with multi-line `expression =`, and relationship blocks.
    M-expression bodies are preserved as-is even when not fully parsed.
    """
    model = PbiModel()
    for tmdl in sorted(input_dir.rglob("*.tmdl")):
        text = tmdl.read_text(encoding="utf-8")
        for table in _parse_tmdl_tables(text):
            model.tables.append(table)
        for rel in _parse_tmdl_relationships(text):
            model.relationships.append(rel)
    return model


_TMDL_TABLE_RE = re.compile(r"^table\s+'?([^'\n]+?)'?\s*$", re.MULTILINE)
_TMDL_COLUMN_RE = re.compile(
    r"^\s+column\s+'?([^'\n]+?)'?\s*$\n((?:\s{2,}.*\n)*)",
    re.MULTILINE,
)
_TMDL_MEASURE_RE = re.compile(
    r"^\s+measure\s+'?([^'\n=]+?)'?\s*=\s*(.*?)$\n((?:\s{2,}.*\n)*)",
    re.MULTILINE | re.DOTALL,
)
_TMDL_RELATIONSHIP_RE = re.compile(
    r"^relationship\s+\S+\s*$\n((?:\s+.*\n)+)",
    re.MULTILINE,
)


def _parse_tmdl_tables(text: str) -> Iterable[PbiTable]:
    matches = list(_TMDL_TABLE_RE.finditer(text))
    for i, m in enumerate(matches):
        name = m.group(1)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end]
        t = PbiTable(name=name)
        for col_m in _TMDL_COLUMN_RE.finditer(body):
            col_name = col_m.group(1)
            attrs = col_m.group(2)
            dt = _tmdl_attr(attrs, "dataType")
            desc = _tmdl_attr(attrs, "description")
            t.columns.append(
                PbiColumn(name=col_name, data_type=dt, description=desc)
            )
        for me_m in _TMDL_MEASURE_RE.finditer(body):
            t.measures.append(
                PbiMeasure(
                    name=me_m.group(1),
                    expression=me_m.group(2).strip(),
                    description=_tmdl_attr(me_m.group(3), "description"),
                )
            )
        yield t


def _parse_tmdl_relationships(text: str) -> Iterable[PbiRelationship]:
    for m in _TMDL_RELATIONSHIP_RE.finditer(text):
        body = m.group(1)
        from_ = _tmdl_attr(body, "fromColumn") or ""
        to_ = _tmdl_attr(body, "toColumn") or ""
        if "." in from_ and "." in to_:
            ft, fc = from_.split(".", 1)
            tt, tc = to_.split(".", 1)
            yield PbiRelationship(
                from_table=ft.strip("'\""),
                from_column=fc.strip("'\""),
                to_table=tt.strip("'\""),
                to_column=tc.strip("'\""),
                cardinality=_tmdl_attr(body, "cardinality") or "manyToOne",
            )


def _tmdl_attr(block: str, key: str) -> str | None:
    m = re.search(rf"^\s*{re.escape(key)}\s*[:=]\s*(.+)$", block, re.MULTILINE)
    return m.group(1).strip().strip("'\"") if m else None


# ---- Emitters -------------------------------------------------------------


def emit_keboola_sl(
    pbi: PbiModel,
    *,
    out_dir: Path,
    bucket_prefix: str,
    model_name: str,
    model_display: str,
    dialect: str = "Snowflake",
) -> list[str]:
    """Write Keboola SL JSON payloads, return list of warnings."""

    warnings: list[str] = []
    model_uuid = str(uuid.uuid4())

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "semantic-dataset").mkdir(exist_ok=True)
    (out_dir / "semantic-metric").mkdir(exist_ok=True)
    (out_dir / "semantic-relationship").mkdir(exist_ok=True)

    pk_hints = _infer_primary_keys(pbi)
    name_to_table_id: dict[str, str] = {}

    # Header. Schema requires name + sql_dialect (snake_case); other fields
    # like displayName/status/tags are allowed but not required.
    (out_dir / "semantic-model.json").write_text(
        json.dumps(
            {
                "name": model_name,
                "displayName": model_display,
                "description": (
                    f"Migrated from Power BI semantic model "
                    f"({len(pbi.tables)} tables, "
                    f"{sum(len(t.measures) for t in pbi.tables)} measures, "
                    f"{len(pbi.relationships)} relationships)."
                ),
                "sql_dialect": dialect,
                "status": "draft",
                "tags": ["powerbi-migration"],
            },
            indent=2,
        )
    )

    # Datasets
    for t in pbi.tables:
        table_slug = slugify(t.name)
        table_id = f"{bucket_prefix}.{table_slug}"
        name_to_table_id[t.name] = table_id

        fields_out: list[dict] = []
        for c in t.columns:
            mapped = map_type(c.data_type)
            if c.data_type and c.data_type.lower() not in PBI_TO_SL_TYPE:
                warnings.append(
                    f"unknown column type {c.data_type!r} on "
                    f"{t.name}.{c.name} → defaulted to string"
                )
            fields_out.append(
                {
                    "name": c.name,
                    **({"description": c.description} if c.description else {}),
                    "type": mapped,
                    "role": _infer_role(c, t, pk_hints),
                }
            )

        dataset = {
            "modelUUID": model_uuid,
            "tableId": table_id,
            "name": t.name,
            **({"description": t.description} if t.description else {}),
            "fqn": f'"{table_id}"',
            "primaryKey": pk_hints.get(t.name, []),
            "fields": fields_out,
        }
        (out_dir / "semantic-dataset" / f"{table_slug}.json").write_text(
            json.dumps(dataset, indent=2, ensure_ascii=False)
        )

    # Metrics
    for t in pbi.tables:
        for me in t.measures:
            metric = {
                "modelUUID": model_uuid,
                "name": me.name,
                **({"description": me.description} if me.description else {}),
                "sql": me.expression,  # DAX preserved verbatim
                "dataset": name_to_table_id[t.name],
            }
            slug = slugify(me.name)
            (out_dir / "semantic-metric" / f"{slug}.json").write_text(
                json.dumps(metric, indent=2, ensure_ascii=False)
            )
            if _looks_like_complex_dax(me.expression):
                warnings.append(
                    f"complex DAX on metric {me.name!r}: "
                    f"{me.expression[:80]}{'…' if len(me.expression) > 80 else ''}"
                )

    # Relationships
    for r in pbi.relationships:
        ft = name_to_table_id.get(r.from_table)
        tt = name_to_table_id.get(r.to_table)
        if not ft or not tt:
            warnings.append(
                f"relationship references unknown table: "
                f"{r.from_table} → {r.to_table}"
            )
            continue
        if r.cardinality == "manyToMany":
            warnings.append(
                f"many-to-many relationship "
                f"{r.from_table}.{r.from_column} ↔ "
                f"{r.to_table}.{r.to_column} — SL prefers star-schema joins; "
                f"emitted as `left`, review."
            )
        rel_payload = {
            "modelUUID": model_uuid,
            "name": f"{r.from_table}__{r.to_table}",
            "from": ft,
            "to": tt,
            "on": f'from."{r.from_column}" = to."{r.to_column}"',
            "type": PBI_CARDINALITY_TO_JOIN.get(r.cardinality, "left"),
        }
        fname = f"{slugify(r.from_table)}__{slugify(r.to_table)}.json"
        (out_dir / "semantic-relationship" / fname).write_text(
            json.dumps(rel_payload, indent=2, ensure_ascii=False)
        )

    if warnings:
        lines = ["# WARNINGS", ""] + [f"- {w}" for w in warnings]
        (out_dir / "WARNINGS.md").write_text("\n".join(lines) + "\n")

    return warnings


_COMPLEX_DAX_HINTS = ("CALCULATE", "RELATED", "FILTER", "ALL(", "VAR ", "DATEADD")


def _looks_like_complex_dax(expr: str) -> bool:
    upper = expr.upper()
    return any(h in upper for h in _COMPLEX_DAX_HINTS)


def _infer_primary_keys(pbi: PbiModel) -> dict[str, list[str]]:
    """Heuristic PK inference.

    Strategy:
      1. Explicit `isKey` columns win.
      2. Otherwise, the `to` side of relationships is treated as PK candidate.
    """
    pks: dict[str, list[str]] = {}
    for t in pbi.tables:
        explicit = [c.name for c in t.columns if c.is_key]
        if explicit:
            pks[t.name] = explicit
    for r in pbi.relationships:
        if r.to_table not in pks:
            pks.setdefault(r.to_table, [])
            if r.to_column not in pks[r.to_table]:
                pks[r.to_table].append(r.to_column)
    return pks


def _infer_role(
    col: PbiColumn, table: PbiTable, pk_hints: dict[str, list[str]]
) -> str:
    if col.name in pk_hints.get(table.name, []):
        return "key"
    t = (col.data_type or "").lower()
    if "date" in t or "time" in t:
        return "timestamp"
    if t in ("int64", "integer", "double", "decimal", "currency"):
        return "measure"
    return "dimension"


# ---- CLI ------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path,
                   help="Path to PowerBI artifacts (folder)")
    p.add_argument("--input-format", required=True,
                   choices=["per-table-json", "tmdl"])
    p.add_argument("--bucket-prefix", required=True,
                   help="Keboola bucket prefix, e.g. in.c-pbi-migration")
    p.add_argument("--model-name", required=True)
    p.add_argument("--model-display", default=None)
    p.add_argument("--dialect", default="Snowflake")
    p.add_argument("--output", required=True, type=Path)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.input_format == "per-table-json":
        pbi = load_per_table_json(args.input)
    else:
        pbi = load_tmdl(args.input)

    if not pbi.tables:
        print("no tables found in input", file=sys.stderr)
        return 1

    warnings = emit_keboola_sl(
        pbi,
        out_dir=args.output,
        bucket_prefix=args.bucket_prefix,
        model_name=args.model_name,
        model_display=args.model_display or args.model_name,
        dialect=args.dialect,
    )

    print(
        f"✅ {len(pbi.tables)} datasets, "
        f"{sum(len(t.measures) for t in pbi.tables)} metrics, "
        f"{len(pbi.relationships)} relationships → {args.output}",
        file=sys.stderr,
    )
    if warnings:
        print(f"⚠ {len(warnings)} warnings — see {args.output}/WARNINGS.md",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
