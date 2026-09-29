"""Parse permanent (ikke-omdrift) afgrødekoder from the wide master CSV."""

from __future__ import annotations

from pathlib import Path

from database.scripts.runtime_lookup_loader import (
    integer,
    read_csv_rows,
    source_path,
    text,
)

CSV_PATH = source_path("Afgroedetabel2027_master.csv")


def parse_permanente_afgrodekoder(path: Path = CSV_PATH) -> list[tuple]:
    source_rows = read_csv_rows(
        path,
        delimiter=",",
        required_columns={"AfgroedeKode", "Navn", "er_permanent_afgroede"},
    )
    rows = [
        (
            integer(row["AfgroedeKode"], field="AfgroedeKode", row_number=row_number),
            text(row["Navn"], field="Navn", row_number=row_number),
        )
        for row_number, row in enumerate(source_rows, start=2)
        if row["er_permanent_afgroede"].strip() == "Ja"
    ]
    if len({row[0] for row in rows}) != len(rows):
        raise ValueError("Permanent crop source contains duplicate afgrødekoder")
    return rows


def load_permanente_afgrodekoder(path: Path = CSV_PATH, database_url: str | None = None) -> None:
    """Compatibility entry point; crop-code sources now reload together."""
    from database.scripts.load_afgroeder import load_afgroeder

    load_afgroeder(master_path=path, database_url=database_url)


if __name__ == "__main__":
    load_permanente_afgrodekoder()
