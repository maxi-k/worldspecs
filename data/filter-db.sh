#!/usr/bin/env sh

OUTPUT_FILE="gapminder-reduced.duckdb"
INPUT_FILE="gapminder.duckdb"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -i, --input      Specify input file [default: gapminder.duckdb]"
    echo "  -o, --output     Specify output file [default: gapminder-reduced.duckdb]"
    echo "  -h, --help       Show this help message"
    exit 1
}

# Parse command line arguments
while [ $# -gt 0 ]; do
    case $1 in
        -o|--output)
            if [ -z "$2" ]; then
                echo "Error: --output requires a filename"
                exit 1
            fi
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -i|--input)
            if [ -z "$2" ]; then
                echo "Error: --input requires a filename"
                exit 1
            fi
            INPUT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        -*)
            echo "Error: Unknown option $1"
            usage
            ;;
    esac
done

test -z "$INPUT_FILE" && usage
test -z "$OUTPUT_FILE" && usage

echo "
ATTACH IF NOT EXISTS '$INPUT_FILE' as input;
ATTACH '$OUTPUT_FILE' as output;
COPY FROM DATABASE input to output;
"
