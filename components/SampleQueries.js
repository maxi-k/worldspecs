export default class SampleQueries {
  #samplesTable; #dropdown;
  constructor(elemId, callback) {
    this.#dropdown = elemId;
    const samplesTable = SampleQueries.parseSamples();
    this.#samplesTable = samplesTable;
    // initialize dropdown
    const $dropdown = $(elemId);
    for (const group_ord in GROUP_ORDER) {
      const group = GROUP_ORDER[group_ord];
      let html = '';
      for (const description in samplesTable[group]) {
        html += `<option value="${description}">${description}</option>`
      }
      $dropdown.append(
        $('<optgroup></optgroup>')
          .attr('label', group)
          .html(html)
      );
    }
    // add on-change handler
    $dropdown.on('change', () => {
      const selected = $(`${elemId} :selected`)
      const data = samplesTable[selected.parent().attr('label')][selected.val()];
      if (!data) { return; }
      const updates = { sqlQuery: data.sql_code, rCode: data.r_code, layout: { type: data.layout } };
      if (!data.r_code && 'repl' in app) {
        updates.rCode = app.repl.minimalRCode();
        updates.layout = updates.layout || { type: 'table' };
      }
      callback(updates);
    });
  }

  static parseSamples() {
    const samplesTable = {};
    SAMPLE_QUERIES.forEach(item => {
      let sqlProcessed = item.sql_code || '';
      let rProcessed = item.r_code || '';
      let group = item.group || "Others";

      if (Array.isArray(sqlProcessed)) {
        sqlProcessed = sqlProcessed.join('\n');
      }
      if (Array.isArray(rProcessed)) {
        rProcessed = rProcessed.join('\n');
      }
      sqlProcessed = sqlProcessed.trim();
      rProcessed = rProcessed.trim();

      if (!(group in samplesTable)) {
        samplesTable[group] = {}
      }

      samplesTable[group][item.description] = {
        sql_code: sqlProcessed,
        r_code: rProcessed,
        layout: item.layout || (!!rProcessed ? 'split' : 'table')
      };
    });
    return samplesTable;
  }
};

const GROUP_ORDER = [
  'Schema Info',
  'GDP & Economy',
  'CO2 & Climate',
  'Country Populations',
  'Others'
];

const SAMPLE_QUERIES = [
  { // ------------------------------------------------------------
    description: "Table Info",
    group: "Schema Info",
    sql_code: `
SELECT table_name, estimated_size, d.column_names[:5] first_five_columns,
  regexp_replace(comment, '(.{40}) ', e'\\\\1\\n', 'g') as description -- linebreaks for long comments
FROM duckdb_tables() a
JOIN (describe) d ON d.name = a.table_name
ORDER BY table_name DESC`,
    r_code: ""
  },
  { // ------------------------------------------------------------
    description: "Metadata Tables",
    group: "Schema Info",
    sql_code: "select * from (describe) where name not like 'datapoints_%';",
    r_code: ""
  },
  { // ------------------------------------------------------------
    description: "Concept Descriptions",
    group: "Schema Info",
    sql_code: "select * from metadata_concepts",
    r_code: ""
  },
  { // ------------------------------------------------------------
    description: "GDP Dev. by Region",
    group: "GDP & Economy",
    sql_code: `
select gdp.time as year,
       cty.world_6region as region,
       avg(gdp.gdp_pcap) as gdp_per_capita,
from datapoints_gdp_pcap_by_country_time gdp
join entities_geo_country cty on cty.country = gdp.country
group by cty.world_6region, gdp.time
order by gdp_per_capita desc`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = year, y = gdp_per_capita, color = region)) +
  scale_y_log10() +
  geom_line() +
  labs(x = 'Year', y = 'GDP per Capita (log)', title = 'Per-Capita GDP Development by Region')

plotly_json(output, pretty=FALSE)`
  },
  { // ------------------------------------------------------------
    description: "Life Expect. vs. GDP",
    group: "GDP & Economy",
    sql_code: `
-- The plot will take a while to render!
select gdp.time as year,
       cty.name as country,
       cty.world_4region as region,
       cty.main_religion_2008 as main_religion,
       gdp.gdp_pcap as gdp_per_capita,
       le.lex as life_expectancy
from datapoints_gdp_pcap_by_country_time gdp
join datapoints_lex_by_country_time le on gdp.country = le.country and gdp.time = le.time
join entities_geo_country cty on cty.country = gdp.country
where gdp.time between 1850 and year(today())`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(y = life_expectancy, x = gdp_per_capita, color = region, frame = year, label = country)) +
  scale_x_log10() +
  geom_point(alpha = 0.7) +
  labs(y = 'Life Expectancy', x = 'GDP per Capita (log scale)', title = 'Development of Life Expectancy and GDP per Capita, per Country')

## output to the html page
plotly_json(output, pretty=FALSE)`
  },
  { // ------------------------------------------------------------
    description: "Internet Users by Region",
    sql_code: `
select r.world_6region as region, u.time, 100 - avg(u.non_net_users_prc) pct
from datapoints_non_net_users_prc_by_country_time u
join entities_geo_country r on r.country = u.country
group by r.world_6region, u.time
`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = time, y = pct, color = region)) +
  expand_limits(y = 0) +
  geom_line() +
  labs(x = 'Year', y = 'Internet Users (%)', title = 'Internet Users (Percent of Total Population) per Region, over Time')

## output to the html page
plotly_json(output, pretty=FALSE)
`
  },
  { // ------------------------------------------------------------
    description: "Country CO2 Transfer",
    group: "CO2 & Climate",
    sql_code: `
select c.name as country, e.time, e.transfer_emissions
from datapoints_transfer_emissions_by_country_time e
join entities_geo_country c on c.country = e.country
where c.name in ('Germany', 'China', 'USA')
`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = time, y = transfer_emissions, color = country)) +
    geom_line() +
    labs(x = 'Year', y = 'CO2 Transfer Emissions (Mtons)', color = 'Country', title = 'CO2 Transfer Emissions by Country, over Time')

## output to the html page
plotly_json(output, pretty=FALSE)
`
  },
  { // ------------------------------------------------------------
    description: "Region CO2 Transfer",
    group: "CO2 & Climate",
    sql_code: `
select c.world_4region as region, e.time, sum(e.transfer_emissions) as transfer_emissions
from datapoints_transfer_emissions_by_country_time e
join entities_geo_country c on c.country = e.country
group by e.time, c.world_4region`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = time, y = transfer_emissions, color = region)) +
    geom_line() +
    labs(color = "Region", x = "Year", y = "Transfer Emissions (Mt CO2)")

output <- layout(ggplotly(output), legend = list(x = 0.05, y = 0.95))

## output to the html page
plotly_json(output, pretty=FALSE)
`
  },
  { // ------------------------------------------------------------
    description: "Immigrants, % of Pop",
    group: 'Country Populations',
    sql_code: `
select i.country, c.name as country_name, i.time, i.immigrant_pc
from datapoints_immigrant_pc_by_country_time i
join entities_geo_country c on c.country = i.country
where c.name in ('Germany', 'USA', 'Japan', 'China', 'Canada')`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = time, y = immigrant_pc, color = country_name)) +
    geom_line() +
    geom_point() +
    labs(x = 'Year', y = 'Immigrants as Pct. of Total Population', color = 'Country')

## output to the html page
plotly_json(output, pretty=FALSE)
`
  },
  { // ------------------------------------------------------------
    description: 'Old People, % of Pop.',
    group: 'Country Populations',
    sql_code: `
select old.time, cty.name as country, old.population_aged_70plus_years_both_sexes_percent as pct_70plus
from datapoints_population_aged_70plus_years_both_sexes_percent_by_geo_time old
join entities_geo_country cty on cty.country = old.geo
where cty.name in ('Germany', 'Japan', 'USA', 'China')`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = time, y = pct_70plus, color = country)) +
    geom_line() +
    expand_limits(y = 0) +
    labs(x = 'Year', y = 'Percent of People aged 70+', title = 'Percent of People aged 70+ by Country over Time')

## output to the html page
plotly_json(output, pretty=FALSE)`
  },
  { // ------------------------------------------------------------
    description: 'Age Groups',
    group: 'Country Populations',
    sql_code: `select old.time, cty.name as country,
	   old.population_aged_70plus_years_total_number as people_70plus,
       young.u5pop as people_5under,
       100.0*old.population_aged_70plus_years_total_number/pop.pop as pct_70plus,
       100.0*young.u5pop/pop.pop as pct_5under,

from datapoints_population_aged_70plus_years_total_number_by_geo_time old
join datapoints_u5pop_by_country_time young on old.time = young.time and old.geo = young.country
join datapoints_pop_by_country_time	pop on pop.country = old.geo and pop.time = old.time
join entities_geo_country cty on cty.country = old.geo

where cty.name in ('Germany', 'China', 'South Korea')
  and old.time < year(today())`,
    r_code: `theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = time, color = country)) +
    geom_line(aes(y = pct_70plus, linetype = '70+')) +
    geom_line(aes(y = pct_5under, linetype = '0-5')) +
    expand_limits(y = 0) +
    labs(x = 'Year', y = 'Percent of People in Age Group', title = 'Percent of People by Age Group and Country',
         linetype = 'Age Group', color = 'Country')

## output to the html page
plotly_json(output, pretty=FALSE)`
  },
  { // ------------------------------------------------------------
    description: `Rich Countries Region`,
    group: "GDP & Economy",
    sql_code: `
select gdp.time,  cty.world_6region as region, count(*) as country_count, string_agg(cty.name) as countries
from entities_geo_country cty
join datapoints_gdp_pcap_by_country_time gdp on gdp.country = cty.country
join (
  select a.time, percentile_cont(0.9) WITHIN GROUP (ORDER BY gdp_pcap ASC)  as thresh
  from datapoints_gdp_pcap_by_country_time a
  group by a.time
) a on a.time = gdp.time and gdp.gdp_pcap > a.thresh
where gdp.time < year(today())
group by gdp.time, cty.world_6region
order by gdp.time, cty.world_6region`,
    r_code: `
theme_set(theme_bw())

### the current table is bound to the variable 'data'
output <- ggplot(data, aes(x = time, y = country_count, fill = region, label = countries)) +
    expand_limits(y = 0) +
    geom_col() +
    labs(x = 'Year', y = 'Nr. of Countries', fill = 'Region',
         title = 'Region of richest 10% of countries over time, as measured by per-capita GPD')

## output to the html page
plotly_json(output, pretty=FALSE)`
  },
]
