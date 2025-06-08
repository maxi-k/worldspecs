# Gapminder to DuckDB Converter

This project converts the Gapminder Systema Globalis dataset from DDF-CSV format to a single DuckDB database with comprehensive documentation.

## Requirements

### System Requirements
- Python 3.7+
- Git (for cloning the Gapminder repository)
- ~2GB free disk space (for the repository and database)

### Python Dependencies

Install dependencies (if not using nixos):
```bash
pip install -r requirements.txt
```

## Quick Start

1. **Install dependencies:**

2. **Run the conversion:**
   ```bash
   python gapminder_to_duckdb.py
   ```

3. **Test the database:**
   ```bash
   python test_gapminder_db.py
   ```

4. **Explore the data:**
   ```bash
   duckdb gapminder.duckdb
   ```

## Detailed Usage

### Basic Conversion
```bash
# Convert with default settings
python gapminder_to_duckdb.py

# Specify custom paths
python gapminder_to_duckdb.py --repo-path ./my-gapminder --output-db my_gapminder.db

# Enable verbose logging
python gapminder_to_duckdb.py --verbose
```

### Command Line Options

- `--repo-path PATH`: Directory to clone/find the Gapminder repository (default: `./ddf--gapminder--systema_globalis`)
- `--output-db PATH`: Output DuckDB database file (default: `gapminder.duckdb`)
- `--verbose, -v`: Enable detailed logging

### Testing the Database
```bash
# Test with default database
python test_gapminder_db.py

# Test custom database
python test_gapminder_db.py --db-path my_gapminder.db
```

## Database Structure

The converter creates the following types of tables:

### Entity Tables (`entities_*`)
- **`entities_geo`**: Geographic entities (countries, regions)
- **`entities_tag`**: Classification tags
- **Other entity tables**: Various dimensional groupings

### Datapoint Tables (`datapoints_*`)
- Named by pattern: `datapoints_{indicator}_by_{dimensions}`
- Examples:
  - `datapoints_population_by_geo_time`
  - `datapoints_gdp_per_capita_by_geo_time`
  - `datapoints_life_expectancy_by_geo_time`

### Metadata Tables
- **`metadata_concepts`**: All concept definitions from `ddf--concepts.csv`
- **`metadata_tables`**: Overview of all tables in the database

## Example Queries

### Explore the Database Structure
```sql
-- List all tables
SHOW TABLES;

-- View table types
SELECT * FROM metadata_tables;

-- Explore concepts
SELECT concept, name, concept_type, unit, description 
FROM metadata_concepts 
WHERE concept_type = 'measure' 
LIMIT 10;
```

### Query Population Data
```sql
-- Get population data for recent years
SELECT geo, time, population 
FROM datapoints_population_by_geo_time 
WHERE time >= 2015 
ORDER BY population DESC 
LIMIT 10;
```

### Query GDP Per Capita
```sql
-- Compare GDP per capita across countries
SELECT g.name as country, d.time, d.gdp_per_capita
FROM datapoints_gdp_per_capita_by_geo_time d
JOIN entities_geo g ON d.geo = g.geo
WHERE d.time = 2020 AND d.gdp_per_capita IS NOT NULL
ORDER BY d.gdp_per_capita DESC
LIMIT 15;
```

### Time Series Analysis
```sql
-- Population growth over time for specific countries
SELECT geo, time, population,
       LAG(population) OVER (PARTITION BY geo ORDER BY time) as prev_population,
       (population - LAG(population) OVER (PARTITION BY geo ORDER BY time)) / 
       LAG(population) OVER (PARTITION BY geo ORDER BY time) * 100 as growth_rate
FROM datapoints_population_by_geo_time
WHERE geo IN ('usa', 'chn', 'ind') 
  AND time >= 2000
ORDER BY geo, time;
```

## Features

### Comprehensive Documentation
- **Table Comments**: Each table has a description explaining its purpose
- **Column Comments**: Columns are documented with concept names, descriptions, and units
- **Metadata Integration**: Concepts from `ddf--concepts.csv` are used for documentation

### Performance Optimizations
- **Indexes**: Automatic creation of indexes on common dimension columns (geo, time, etc.)
- **Efficient Loading**: Uses DuckDB's optimized CSV reader with auto-detection
- **Union Optimization**: Similar datapoint files are intelligently combined

### Data Quality
- **English Only**: Filters out non-English translations automatically
- **Schema Inference**: Automatic data type detection and optimization
- **Error Handling**: Robust error handling with detailed logging

## Troubleshooting

### Common Issues

1. **Git not found**
   ```
   Error: Git is required but not found
   ```
   **Solution**: Install Git from https://git-scm.com/

2. **Permission errors**
   ```
   Error: Permission denied when cloning repository
   ```
   **Solution**: Ensure you have write permissions in the target directory

3. **Memory issues**
   ```
   Error: Out of memory
   ```
   **Solution**: The script processes files incrementally, but very large datasets might need more RAM. Try closing other applications.

4. **CSV parsing errors**
   ```
   Error: Could not parse CSV file
   ```
   **Solution**: Some CSV files might have encoding issues. The script handles most cases automatically.

### Performance Tips

- **Use SSD storage** for better I/O performance
- **Ensure adequate RAM** (4GB+ recommended)
- **Run with verbose logging** (`-v`) to monitor progress on large datasets

## Data Sources

This converter works with the official Gapminder Systema Globalis repository:
- **Repository**: https://github.com/open-numbers/ddf--gapminder--systema_globalis
- **License**: Creative Commons Attribution 4.0 International
- **Format**: DDF-CSV (Data Description Format)

## Output

The conversion creates:
- A single `.duckdb` file containing all data
- Properly documented tables and columns
- Optimized indexes for common queries
- Metadata tables for easy exploration

## Limitations

- Only processes English translations (skips other languages)
- Requires Git for repository access
- Memory usage scales with dataset size
- Some very complex DDF structures might need manual handling

## Contributing

To improve this converter:
1. Test with different DDF datasets
2. Add support for additional metadata types
3. Optimize for specific query patterns
4. Add more comprehensive error handling

## License

This converter script is provided as-is. The Gapminder data itself is licensed under Creative Commons Attribution 4.0 International.
