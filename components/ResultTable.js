// For rendering EC2 Table
import 'datatables.net-responsive-dt';
import './ResultTable.css'
import { copyToClipboard } from '/util.js'
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
    let tbl = elem.empty().DataTable({
      data: rows,
      columns: mappedCols,
      ordering: false,
      scrollX: true,
      scrollCollapse: true,
      // dom: '<"top-toolbar d-flex justify-content-between align-items-center"lBf>rtip',
      dom: '<"top-toolbar d-flex justify-content-between align-items-center"iBf>rt<"bottom-toolbar d-flex justify-content-between align-items-center"lp><"clear">',
      buttons: [
        {
          extend: 'csv',
          filename: 'ec2_instances_data',
          text: 'Export Result [CSV]'
        },
        {
          extend: 'excel',
          filename: 'ec2_instances_data',
          text: 'Export Result [XLS]'
        }
      ],
      pageLength: 100, // default row count
      lengthMenu: [10, 25, 50, 100, 200, 1000]
    });

    $(tbl.table().header()).on('click', 'th', function() {
      let txt = $(this, '.dt-column-title').text();
      copyToClipboard(txt, `'${txt}' copied to clipboard`);
    });
  };


};
