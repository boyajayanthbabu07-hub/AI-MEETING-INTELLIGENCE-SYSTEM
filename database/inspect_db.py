import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import engine
from sqlalchemy import inspect

inspector = inspect(engine)
for table in inspector.get_table_names():
    print(f"=== Table: {table} ===")
    for col in inspector.get_columns(table):
        name = col["name"]
        col_type = str(col["type"])
        nullable = col["nullable"]
        default = col["default"]
        print(f"  - {name}: {col_type} (nullable={nullable}, default={default})")
    fks = inspector.get_foreign_keys(table)
    if fks:
        print("  Foreign Keys:", fks)
    indexes = inspector.get_indexes(table)
    if indexes:
        print("  Indexes:", indexes)
