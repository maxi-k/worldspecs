#!/usr/bin/env python3
"""
Gapminder Systema Globalis to DuckDB Converter

This script converts the Gapminder Systema Globalis dataset from DDF-CSV format
to a single DuckDB database with proper table and column documentation.

The script handles:
- Concepts (metadata definitions)
- Entities (geographical and categorical dimensions)
- Datapoints (actual statistical data)
- Automatic schema inference and documentation generation

Usage:
    python gapminder_to_duckdb.py [--repo-path PATH] [--output-db PATH] [--verbose]
"""

import os
import sys
import argparse
import logging
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
import pandas as pd
import duckdb

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class GapminderToDuckDB:
    """Main class for converting Gapminder DDF data to DuckDB."""

    def __init__(self, repo_path: str, output_db: str, verbose: bool = False):
        self.repo_path = Path(repo_path)
        self.output_db = Path(output_db)
        self.verbose = verbose
        self.connection = None

        # Storage for metadata
        self.concepts: Dict[str, Dict] = {}
        self.entities: Dict[str, Dict] = {}
        self.datapoint_files: List[Path] = []

        if verbose:
            logger.setLevel(logging.DEBUG)

    def clone_or_update_repo(self) -> None:
        """Clone the repository if it doesn't exist, or update if it does."""
        repo_url = "https://github.com/open-numbers/ddf--gapminder--systema_globalis.git"

        if not self.repo_path.exists():
            logger.info(f"Cloning repository to {self.repo_path}")
            subprocess.run([
                "git", "clone", "--depth", "1", repo_url, str(self.repo_path)
            ], check=True)
        else:
            logger.info(f"Repository exists at {self.repo_path}, pulling latest changes")
            subprocess.run([
                "git", "-C", str(self.repo_path), "pull"
            ], check=True)

    def connect_db(self) -> None:
        """Create or connect to the DuckDB database."""
        if self.output_db.exists():
            logger.info(f"Connecting to existing database: {self.output_db}")
        else:
            logger.info(f"Creating new database: {self.output_db}")

        self.connection = duckdb.connect(str(self.output_db))

        # Enable CSV auto-detection and configure for better performance
        self.connection.execute("SET enable_object_cache=true;")
        self.connection.execute("SET threads=4;")

    def load_concepts(self) -> None:
        """Load and parse the concepts file for metadata."""
        concepts_file = self.repo_path / "ddf--concepts.csv"

        if not concepts_file.exists():
            logger.warning(f"Concepts file not found: {concepts_file}")
            return

        logger.info("Loading concepts...")
        try:
            df = pd.read_csv(concepts_file, encoding='utf-8')

            # Clean column names
            df.columns = df.columns.str.strip()

            for _, row in df.iterrows():
                concept_id = str(row.get('concept', '')).strip()
                if concept_id:
                    self.concepts[concept_id] = {
                        'name': str(row.get('name', concept_id)),
                        'concept_type': str(row.get('concept_type', '')),
                        'description': str(row.get('description', '')),
                        'unit': str(row.get('unit', '')),
                        'domain': str(row.get('domain', '')),
                        'tags': str(row.get('tags', ''))
                    }

            logger.info(f"Loaded {len(self.concepts)} concepts")

        except Exception as e:
            logger.error(f"Error loading concepts: {e}")

    def discover_files(self) -> None:
        """Discover all DDF CSV files in the repository."""
        logger.info("Discovering DDF files...")

        # Find all CSV files that follow DDF naming convention
        for csv_file in self.repo_path.rglob("*.csv"):
            filename = csv_file.name

            # Skip non-English files (look for language indicators)
            if any(lang in filename for lang in ['--zh', '--es', '--fr', '--ar', '--ru']):
                continue

            # Skip the concepts file (already handled separately)
            if filename == "ddf--concepts.csv":
                continue

            # Categorize files
            if filename.startswith("ddf--entities"):
                # Entity files
                entity_type = self._extract_entity_type(filename)
                if entity_type:
                    self.entities[entity_type] = {
                        'file': csv_file,
                        'name': entity_type.replace('_', ' ').title()
                    }
            elif filename.startswith("ddf--datapoints"):
                # Datapoint files
                self.datapoint_files.append(csv_file)

        logger.info(f"Found {len(self.entities)} entity files")
        logger.info(f"Found {len(self.datapoint_files)} datapoint files")

    def _extract_entity_type(self, filename: str) -> Optional[str]:
        """Extract entity type from filename."""
        # Pattern: ddf--entities--<entity_type>.csv
        match = re.match(r'ddf--entities--(.+)\.csv', filename)
        return match.group(1) if match else None

    def _extract_datapoint_info(self, filename: str) -> Tuple[str, List[str]]:
        """Extract indicator and dimensions from datapoint filename."""
        # Pattern: ddf--datapoints--<indicator>--by--<dim1>--<dim2>--etc.csv
        parts = filename.replace('.csv', '').split('--')

        if len(parts) >= 3 and parts[0] == 'ddf' and parts[1] == 'datapoints':
            indicator = parts[2]

            # Find 'by' separator
            try:
                by_index = parts.index('by')
                dimensions = parts[by_index + 1:]
            except ValueError:
                dimensions = []

            return indicator, dimensions

        return filename.replace('.csv', ''), []

    def create_entity_tables(self) -> None:
        """Create tables for entities."""
        logger.info("Creating entity tables...")

        for entity_type, entity_info in self.entities.items():
            try:
                table_name = f"entities_{entity_type}"
                csv_file = entity_info['file']

                logger.debug(f"Processing entity file: {csv_file}")

                # Read a sample to understand structure
                sample_df = pd.read_csv(csv_file, nrows=5, encoding='utf-8')

                # Create table using DuckDB's CSV auto-detection
                create_sql = f"""
                CREATE OR REPLACE TABLE {table_name} AS
                SELECT * FROM read_csv_auto('{csv_file}', header=true, sample_size=1000)
                """

                self.connection.execute(create_sql)

                # Add table comment
                entity_description = entity_info.get('name', entity_type.replace('_', ' ').title())
                table_desc = f'Entity table for {entity_description}. Contains dimensional data used for grouping and filtering datapoints.'
                # Escape single quotes in table description
                table_desc_escaped = table_desc.replace("'", "''")
                table_comment_sql = f"""
                COMMENT ON TABLE {table_name} IS '{table_desc_escaped}'
                """
                self.connection.execute(table_comment_sql)

                # Add column comments
                self._add_column_comments(table_name, sample_df.columns.tolist())

                # Get row count for logging
                count = self.connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                logger.info(f"Created entity table '{table_name}' with {count} rows")

            except Exception as e:
                logger.error(f"Error creating entity table for {entity_type}: {e}")

    def create_datapoint_tables(self) -> None:
        """Create tables for datapoints."""
        logger.info("Creating datapoint tables...")

        # Group datapoint files by indicator and dimensions
        datapoint_groups = {}

        for dp_file in self.datapoint_files:
            indicator, dimensions = self._extract_datapoint_info(dp_file.name)

            # Create a key for grouping similar datapoints
            key = f"{indicator}_by_{'_'.join(dimensions)}" if dimensions else indicator

            if key not in datapoint_groups:
                datapoint_groups[key] = []
            datapoint_groups[key].append(dp_file)

        # Create tables for each group
        for group_key, files in datapoint_groups.items():
            try:
                table_name = f"datapoints_{self._sanitize_table_name(group_key)}"

                if len(files) == 1:
                    # Single file
                    self._create_single_datapoint_table(table_name, files[0])
                else:
                    # Multiple files - union them
                    self._create_union_datapoint_table(table_name, files)

            except Exception as e:
                logger.error(f"Error creating datapoint table for {group_key}: {e}")

    def _create_single_datapoint_table(self, table_name: str, csv_file: Path) -> None:
        """Create a table from a single datapoint CSV file."""
        logger.debug(f"Creating single datapoint table: {table_name}")

        # Read sample to understand structure
        sample_df = pd.read_csv(csv_file, nrows=5, encoding='utf-8')

        # Create table
        create_sql = f"""
        CREATE OR REPLACE TABLE {table_name} AS
        SELECT * FROM read_csv_auto('{csv_file}', header=true, sample_size=1000)
        """

        self.connection.execute(create_sql)

        # Add comments
        indicator, dimensions = self._extract_datapoint_info(csv_file.name)
        self._add_datapoint_table_comments(table_name, indicator, dimensions, sample_df.columns.tolist())

        # Log result
        count = self.connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        logger.info(f"Created datapoint table '{table_name}' with {count} rows")

    def _create_union_datapoint_table(self, table_name: str, csv_files: List[Path]) -> None:
        """Create a table by unioning multiple datapoint CSV files."""
        logger.debug(f"Creating union datapoint table: {table_name} from {len(csv_files)} files")

        # Create UNION query
        union_parts = []
        for csv_file in csv_files:
            union_parts.append(f"SELECT * FROM read_csv_auto('{csv_file}', header=true, sample_size=500)")

        union_sql = " UNION ALL ".join(union_parts)
        create_sql = f"CREATE OR REPLACE TABLE {table_name} AS ({union_sql})"

        self.connection.execute(create_sql)

        # Add comments using first file for indicator/dimensions info
        sample_df = pd.read_csv(csv_files[0], nrows=5, encoding='utf-8')
        indicator, dimensions = self._extract_datapoint_info(csv_files[0].name)
        self._add_datapoint_table_comments(table_name, indicator, dimensions, sample_df.columns.tolist())

        # Log result
        count = self.connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
        logger.info(f"Created union datapoint table '{table_name}' with {count} rows from {len(csv_files)} files")

    def _add_datapoint_table_comments(self, table_name: str, indicator: str, dimensions: List[str], columns: List[str]) -> None:
        """Add table and column comments for datapoint tables."""
        # Table comment
        concept_info = self.concepts.get(indicator, {})
        indicator_name = concept_info.get('name', indicator)
        indicator_desc = concept_info.get('description', '')
        unit = concept_info.get('unit', '')

        table_desc = f"Datapoints for indicator '{indicator_name}'"
        if dimensions:
            table_desc += f" broken down by: {', '.join(dimensions)}"
        if indicator_desc:
            table_desc += f". {indicator_desc}"
        if unit:
            table_desc += f" Unit: {unit}"

        # Escape single quotes in table description
        table_desc_escaped = table_desc.replace("'", "''")
        table_comment_sql = f"COMMENT ON TABLE {table_name} IS '{table_desc_escaped}'"
        self.connection.execute(table_comment_sql)

        # Column comments
        self._add_column_comments(table_name, columns)

    def _add_column_comments(self, table_name: str, columns: List[str]) -> None:
        """Add comments to table columns based on concepts."""
        for column in columns:
            concept_info = self.concepts.get(column, {})
            if concept_info:
                name = concept_info.get('name', column)
                desc = concept_info.get('description', '')
                unit = concept_info.get('unit', '')

                comment = name
                if desc and desc != name:
                    comment += f". {desc}"
                if unit:
                    comment += f" (Unit: {unit})"

                # Escape single quotes in comment
                comment = comment.replace("'", "''")

                try:
                    column_comment_sql = f"COMMENT ON COLUMN {table_name}.{column} IS '{comment}'"
                    self.connection.execute(column_comment_sql)
                except Exception as e:
                    logger.warning(f"Could not add comment to column {table_name}.{column}: {e}")

    def _sanitize_table_name(self, name: str) -> str:
        """Sanitize table name for SQL compatibility."""
        # Replace problematic characters with underscores
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name)
        # Ensure it doesn't start with a number
        if sanitized and sanitized[0].isdigit():
            sanitized = f"t_{sanitized}"
        return sanitized

    def create_metadata_views(self) -> None:
        """Create helpful metadata views."""
        logger.info("Creating metadata views...")

        try:
            # View of all concepts
            concepts_data = []
            for concept_id, info in self.concepts.items():
                concepts_data.append({
                    'concept': concept_id,
                    'name': info.get('name', ''),
                    'concept_type': info.get('concept_type', ''),
                    'description': info.get('description', ''),
                    'unit': info.get('unit', ''),
                    'domain': info.get('domain', ''),
                    'tags': info.get('tags', '')
                })

            if concepts_data:
                concepts_df = pd.DataFrame(concepts_data)
                self.connection.execute("CREATE OR REPLACE TABLE metadata_concepts AS SELECT * FROM concepts_df")
                self.connection.execute("""
                    COMMENT ON TABLE metadata_concepts IS
                    'Metadata table containing all concept definitions from the original ddf--concepts.csv file'
                """)

            # View of all tables with their descriptions
            tables_sql = """
            CREATE OR REPLACE VIEW metadata_tables AS
            SELECT
                table_name,
                CASE
                    WHEN table_name LIKE 'entities_%' THEN 'Entity Table'
                    WHEN table_name LIKE 'datapoints_%' THEN 'Datapoint Table'
                    WHEN table_name LIKE 'metadata_%' THEN 'Metadata Table'
                    ELSE 'Other'
                END as table_type,
                obj_description(oid) as description
            FROM information_schema.tables t
            LEFT JOIN (
                SELECT oid, relname
                FROM pg_class
                WHERE relkind = 'r'
            ) c ON t.table_name = c.relname
            WHERE table_schema = 'main'
            ORDER BY table_type, table_name
            """

            # For DuckDB, we need a simpler approach
            self.connection.execute("""
                CREATE OR REPLACE VIEW metadata_tables AS
                SELECT
                    table_name,
                    CASE
                        WHEN table_name LIKE 'entities_%' THEN 'Entity Table'
                        WHEN table_name LIKE 'datapoints_%' THEN 'Datapoint Table'
                        WHEN table_name LIKE 'metadata_%' THEN 'Metadata Table'
                        ELSE 'Other'
                    END as table_type
                FROM information_schema.tables
                WHERE table_schema = 'main'
                ORDER BY table_type, table_name
            """)

            logger.info("Created metadata views")

        except Exception as e:
            logger.error(f"Error creating metadata views: {e}")

    def create_indexes(self) -> None:
        """Create useful indexes for better query performance."""
        logger.info("Creating indexes...")

        try:
            # Get all table names
            tables = self.connection.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'main' AND table_name NOT LIKE 'metadata_%'
            """).fetchall()

            for (table_name,) in tables:
                try:
                    # Get column names
                    columns = self.connection.execute(f"""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name = '{table_name}' AND table_schema = 'main'
                    """).fetchall()

                    column_names = [col[0] for col in columns]

                    # Create indexes on common dimension columns
                    index_candidates = ['geo', 'country', 'time', 'year', 'region']
                    for candidate in index_candidates:
                        if candidate in column_names:
                            index_name = f"idx_{table_name}_{candidate}"
                            try:
                                self.connection.execute(f"CREATE INDEX {index_name} ON {table_name} ({candidate})")
                                logger.debug(f"Created index {index_name}")
                            except Exception:
                                # Index might already exist or column type not suitable
                                pass

                except Exception as e:
                    logger.warning(f"Could not create indexes for table {table_name}: {e}")

        except Exception as e:
            logger.error(f"Error creating indexes: {e}")


    def print_summary(self) -> None:
        """Print a summary of the created database."""
        logger.info("Database creation summary:")

        try:
            # Count tables by type
            tables = self.connection.execute("""
                with table_types as (
                     select *,
                             CASE
                                 WHEN table_name LIKE 'entities_%' THEN 'Entity Tables'
                                 WHEN table_name LIKE 'datapoints_%' THEN 'Datapoint Tables'
                                 WHEN table_name LIKE 'metadata_%' THEN 'Metadata Tables'
                                 ELSE 'Other Tables'
                             END as table_type
                     from information_schema.tables
                )
                SELECT table_type, COUNT(*) as count
                FROM table_types
                WHERE table_schema = 'main'
                GROUP BY table_type
                ORDER BY table_type
            """).fetchall()

            for table_type, count in tables:
                logger.info(f"  {table_type}: {count}")

            # Total row counts
            all_tables = self.connection.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'main' AND table_name NOT LIKE 'metadata_%'
            """).fetchall()

            total_rows = 0
            for (table_name,) in all_tables:
                try:
                    count = self.connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    total_rows += count
                except Exception:
                    pass

            logger.info(f"  Total data rows: {total_rows:,}")

            # Database size (approximate)
            db_size = self.output_db.stat().st_size / (1024 * 1024)  # MB
            logger.info(f"  Database size: {db_size:.1f} MB")

        except Exception as e:
            logger.error(f"Error generating summary: {e}")
    
    def run(self) -> None:
        """Run the complete conversion process."""
        try:
            logger.info("Starting Gapminder to DuckDB conversion...")
            
            # Step 1: Get the data
            self.clone_or_update_repo()
            
            # Step 2: Connect to database
            self.connect_db()
            
            # Step 3: Load metadata
            self.load_concepts()
            
            # Step 4: Discover files
            self.discover_files()
            
            # Step 5: Create entity tables
            self.create_entity_tables()
            
            # Step 6: Create datapoint tables
            self.create_datapoint_tables()
            
            # Step 7: Create metadata views
            self.create_metadata_views()

            # Step 8: Create indexes
            self.create_indexes()

            # Step 9: Print summary
            self.print_summary()

            logger.info(f"Conversion completed successfully! Database saved to: {self.output_db}")

        except Exception as e:
            logger.error(f"Conversion failed: {e}")
            raise
        finally:
            if self.connection:
                self.connection.close()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Convert Gapminder Systema Globalis data to DuckDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python gapminder_to_duckdb.py
  python gapminder_to_duckdb.py --repo-path ./gapminder-data --output-db gapminder.db
  python gapminder_to_duckdb.py --verbose
        """
    )

    parser.add_argument(
        '--repo-path',
        default='./ddf--gapminder--systema_globalis',
        help='Path where to clone/find the Gapminder repository (default: ./ddf--gapminder--systema_globalis)'
    )

    parser.add_argument(
        '--output-db',
        default='gapminder.duckdb',
        help='Output DuckDB database file (default: gapminder.duckdb)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Check if required tools are available
    try:
        subprocess.run(['git', '--version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.error("Git is required but not found. Please install Git.")
        sys.exit(1)

    # Run conversion
    converter = GapminderToDuckDB(
        repo_path=args.repo_path,
        output_db=args.output_db,
        verbose=args.verbose
    )

    try:
        converter.run()
    except KeyboardInterrupt:
        logger.info("Conversion interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
