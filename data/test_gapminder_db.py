#!/usr/bin/env python3
"""
Test script for the Gapminder DuckDB conversion.

This script tests the converted database by running various queries
to verify data integrity and structure.
"""

import duckdb
import sys
from pathlib import Path


def test_database(db_path: str) -> None:
    """Test the converted Gapminder database."""

    db_file = Path(db_path)
    if not db_file.exists():
        print(f"❌ Database file not found: {db_path}")
        print("Please run the conversion script first:")
        print("python gapminder_to_duckdb.py")
        sys.exit(1)

    print(f"🔍 Testing database: {db_path}")
    print("=" * 50)

    try:
        conn = duckdb.connect(db_path)

        # Test 1: Check if metadata tables exist
        print("\n📊 Database Structure:")
        tables = conn.execute("""
            with table types as (
                select *,
                   CASE
                       WHEN table_name LIKE 'entities_%' THEN 'Entity'
                       WHEN table_name LIKE 'datapoints_%' THEN 'Datapoint'
                       WHEN table_name LIKE 'metadata_%' THEN 'Metadata'
                       ELSE 'Other'
                   END as type
                from information_schema.tables
            )
            SELECT table_name, type
            FROM table_types
            WHERE table_schema = 'main'
            ORDER BY type, table_name
        """).fetchall()

        entity_count = sum(1 for _, t in tables if t == 'Entity')
        datapoint_count = sum(1 for _, t in tables if t == 'Datapoint')
        metadata_count = sum(1 for _, t in tables if t == 'Metadata')

        print(f"  Entity tables: {entity_count}")
        print(f"  Datapoint tables: {datapoint_count}")
        print(f"  Metadata tables: {metadata_count}")
        print(f"  Total tables: {len(tables)}")

        # Test 2: Check concepts metadata
        print("\n📚 Concepts Metadata:")
        try:
            concepts = conn.execute("SELECT COUNT(*) FROM metadata_concepts").fetchone()[0]
            print(f"  Total concepts: {concepts}")

            # Show sample concepts
            sample_concepts = conn.execute("""
                SELECT concept, name, concept_type, unit
                FROM metadata_concepts
                WHERE concept_type IN ('measure', 'entity_domain', 'time')
                LIMIT 5
            """).fetchall()

            print("  Sample concepts:")
            for concept, name, ctype, unit in sample_concepts:
                unit_str = f" ({unit})" if unit and unit != 'nan' else ""
                print(f"    {concept}: {name} [{ctype}]{unit_str}")

        except Exception as e:
            print(f"  ⚠️  Could not access metadata_concepts: {e}")

        # Test 3: Check entity data
        print("\n🌍 Entity Data:")
        entity_tables = [name for name, table_type in tables if table_type == 'Entity']

        for table_name in entity_tables[:3]:  # Show first 3 entity tables
            try:
                count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                print(f"  {table_name}: {count} entities")

                # Show sample data
                sample = conn.execute(f"SELECT * FROM {table_name} LIMIT 1").fetchone()
                if sample:
                    columns = [desc[0] for desc in conn.description]
                    sample_str = ", ".join([f"{col}={val}" for col, val in zip(columns[:3], sample[:3])])
                    print(f"    Sample: {sample_str}...")

            except Exception as e:
                print(f"    ⚠️  Error accessing {table_name}: {e}")

        # Test 4: Check datapoint data
        print("\n📈 Datapoint Data:")
        datapoint_tables = [name for name, table_type in tables if table_type == 'Datapoint']

        total_datapoints = 0
        for table_name in datapoint_tables[:5]:  # Show first 5 datapoint tables
            try:
                count = conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                total_datapoints += count
                print(f"  {table_name}: {count:,} datapoints")

                # Show sample data structure
                columns = conn.execute(f"""
                    SELECT column_name
