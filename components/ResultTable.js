// For rendering EC2 Table
import 'datatables.net-responsive-dt';
import './ResultTable.css'
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
    let mappedCols = columns.map(key => ({
      title: key,
      data: row => row[key],
      render: function(data, type, row) {
        return typeof(data) === 'string' && type == 'display'
          ? data.split('\n').join("<br/>")
          : data;
      }
    }));
    let res = elem.empty().DataTable({
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
  }

};
