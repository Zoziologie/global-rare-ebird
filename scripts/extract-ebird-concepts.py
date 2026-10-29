"""Extract reportable Avibase concepts from an eBird five-tab taxonomy workbook."""
import csv
import hashlib
import json
import sys
from pathlib import Path

import openpyxl

root = Path(__file__).resolve().parents[1]
directory = root / "raw-data/taxonomy-review"
snapshot = json.loads((directory / "snapshot.json").read_text())
source = Path(sys.argv[1])
workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)

# Verify the workbook edition against the versioned API snapshot ------------
versions = {row[2] for row in workbook["Fleshed"].iter_rows(min_row=2, max_col=3, values_only=True)}
if versions != {snapshot["version"]}:
    raise ValueError(f"Workbook editions {versions} do not match API version {snapshot['version']}")

# Retain exact reportable IDs; do not infer nonreportable subspecies ---------
rows = workbook["Sparse"].iter_rows(max_col=6, values_only=True)
header = next(rows)
fields = ["taxon_order", "category", "species_code", "bio_concept_code", "primary_com_name", "sci_name"]
indices = [header.index(field) for field in fields]
output = directory / f"ebird-{snapshot['version']}-concepts.csv"
with output.open("w", newline="", encoding="utf-8") as stream:
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow([f"sort v{snapshot['version']}", "category", "species_code", "taxon concept ID", "primary_com_name", "sci_name"])
    writer.writerows([row[index] for index in indices] for row in rows)
workbook.close()

# Record both original and extracted bytes for reproducibility -------------
provenance = {
    "version": snapshot["version"], "sourceFile": source.name, "sheet": "Sparse",
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "path": str(output.relative_to(root)),
    "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    "scope": "Reportable taxa only; nonreportable subspecies are absent.",
}
output.with_suffix(".source.json").write_text(json.dumps(provenance, indent=2) + "\n")
print(json.dumps(provenance, indent=2))
