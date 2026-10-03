"""Convert the official DAK table to the CSV read by the linear taxonomy workflow."""
import csv
import sys

import pdfplumber

# Read table cells ----------------------------------------------------------
rows = []
with pdfplumber.open(sys.argv[1]) as pdf:
    for index, page in enumerate(pdf.pages):
        table = page.extract_table()
        if index == 0:
            table = table[2:]  # Two header rows; the first page has merged cells.
        for row in table:
            cells = [row[0], row[1], " ".join(cell for cell in row[2:-1] if cell), row[-1]]
            rows.append([" ".join((cell or "").split()) for cell in cells])

# Save the original row order, restrictions, and cross-page continuations ---
with open(sys.argv[2], "w", newline="", encoding="utf-8") as output:
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["Deutscher Name", "Englischer Name", "Wissenschaftlicher\nName", "Einschränkungen"])
    writer.writerows(rows)
