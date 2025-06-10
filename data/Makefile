##
# WorldSpecs data
#
# @file
# @version 0.1
.DEFAULT_GOAL := gapminder-reduced.duckdb

# TODO dependency on git commit of ddf repo if it exists?

REPO_PREFIX ?= ddf--gapminder--
BASE_URL ?= https://github.com/open-numbers

$(REPO_PREFIX)%:
	git clone --depth 1 $(BASE_URL)/$(REPO_PREFIX)$*.git $@

ddf-%.duckdb: gapminder_to_duckdb.py | $(REPO_PREFIX)%
	python gapminder_to_duckdb.py --no-indexes \
			--source-repo $(BASE_URL)/$(REPO_PREFIX)$*.git \
			--repo-path $(REPO_PREFIX)$* \
			--output-db ddf-$*.duckdb

gapminder-reduced.duckdb: ddf-fasttrack.duckdb filter-db.sh
	rm -f $@
	sh filter-db.sh -i "$<" -o "$@" | tee /tmp/duckdb-filter-log.sql | duckdb

test: ddf-systema_globalis.duckdb ddf-fasttrack.duckdb
	python test_gapminder_db.py --db-path ddf-systema_globalis.duckdb
	python test_gapminder_db.py --db-path ddf-fasttrack.duckdb

.PHONY: test


# end
