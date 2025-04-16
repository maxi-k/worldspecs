// For rendering EC2 Table
import 'datatables.net-responsive-dt';

/// XXX replace cdn with js modules and bundle using vite

export default class ResultTable {
  #selector;

  constructor(selector) {
    this.#selector = selector;
  }

  render(columns, rows, query) {
    let elem = $(this.#selector);
    if ( $.fn.dataTable.isDataTable( this.#selector ) ) {
      elem.DataTable().clear();
      elem.DataTable().destroy();
    }
    let mappedCols = columns.map(key => ({ title: key, data: row => row[key] }));
    let res = elem.empty().DataTable({
        data: rows,
        columns: mappedCols,
        ordering: false,
        scrollX: true, // issue with too few columns
        dom: '<"top-toolbar d-flex justify-content-between align-items-center"lBf>rtip',
        buttons: [
            {
                extend: 'csv',
                filename: 'ec2_instances_data',
                text: 'CSV'
            },
            {
                extend: 'excel',
                filename: 'ec2_instances_data',
                text: 'Excel'
            },
            {
                text: 'DuckDB [Whole Database]',
                action: function (e, dt, node, config) {
                    window.location.href = 'https://github.com/TUM-DIS/EC2Bench/blob/main/static/cloudspecs.duckdb'; // Target URL
                },
                className: 'btn btn-primary'  // Bootstrap styling (optional)
            },
            {
                text: 'Share',
                action: function () {
                    const encodedQuery = base64Encode(query);
                    const shareableLink = setQueryParam("query", encodedQuery);
                    copyToClipboard(shareableLink);
                }
            }],
        pageLength: 100, // default row count
        lengthMenu: [10, 25, 50, 100, 200, 1000]
    });
  }

};
