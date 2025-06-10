##
# WorldSpecs data
#
# @file
# @version 0.1

# TODO dependency on git commit of ddf repo if it exists?
gapminder.duckdb: gapminder_to_duckdb.py
	python gapminder_to_duckdb.py --no-indexes

gapminder-reduced.duckdb: gapminder.duckdb filter-db.sh
	rm -f $@
	sh filter-db.sh -i "$<" -o "$@" | duckdb

test: gapminder.duckdb
	python test_gapminder_db.py
.PHONY: test

# end
