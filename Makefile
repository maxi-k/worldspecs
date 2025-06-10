##
# Project Title
#
# @file
# @version 0.1


data/gapminder.duckdb:
	cd data && $(MAKE) gapminder.duckdb

static/worldspecs.duckdb: data/gapminder.duckdb
	cd data && $(MAKE) gapminder-reduced.duckdb
	mv data/gapminder-reduced.duckdb static/worldspecs.duckdb

deps: package.json package-lock.json
	npm i
.PHONY: deps

dev: deps static/worldspecs.duckdb
	npm run dev
.PHONY: dev

# end
